import { useEffect, useRef, useState } from 'react';
import { createWalletClient, custom, getAddress, parseEventLogs, type Address, type EIP1193Provider, type Hash } from 'viem';
import { mainnet } from 'viem/chains';
import { publicClient, readStats, readWalletAllowance, formatContractError } from './chain';
import { SWARM_ADDRESS } from './config';
import { swarmPepeAbi } from './abi';

class WalletActionError extends Error {}
const walletError = (error: unknown) => error instanceof WalletActionError ? error.message : formatContractError(error);

type Provider = EIP1193Provider & { on?: (event: string, listener: (...args: unknown[]) => void) => void; removeListener?: (event: string, listener: (...args: unknown[]) => void) => void };
type WalletOption = { name: string; uuid: string; provider: Provider };
declare global { interface Window { ethereum?: Provider } }

export function useWallet() {
  const [options, setOptions] = useState<WalletOption[]>([]);
  const [choice, setChoice] = useState('');
  const [provider, setProvider] = useState<Provider>();
  const [address, setAddress] = useState<Address>();
  const [chainId, setChainId] = useState<number>();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const active = useRef(false);
  useEffect(() => {
    const announce = (event: Event) => {
      const detail = (event as CustomEvent<{ info: { name: string; uuid: string }; provider: Provider }>).detail;
      if (!detail?.provider || !detail.info) return;
      setOptions(list => list.some(w => w.uuid === detail.info.uuid) ? list : [...list, { ...detail.info, provider: detail.provider }]);
    };
    window.addEventListener('eip6963:announceProvider', announce);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    return () => window.removeEventListener('eip6963:announceProvider', announce);
  }, []);
  useEffect(() => {
    if (!provider) return;
    const accountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      if (active.current) setAddress(accounts?.[0] ? getAddress(accounts[0]) : undefined);
    };
    const chainChanged = (...args: unknown[]) => setChainId(Number(args[0]));
    const disconnected = () => { active.current = false; setAddress(undefined); setChainId(undefined); };
    provider.on?.('accountsChanged', accountsChanged);
    provider.on?.('chainChanged', chainChanged);
    provider.on?.('disconnect', disconnected);
    return () => {
      provider.removeListener?.('accountsChanged', accountsChanged);
      provider.removeListener?.('chainChanged', chainChanged);
      provider.removeListener?.('disconnect', disconnected);
    };
  }, [provider]);
  async function connect() {
    setError(''); setConnecting(true);
    try {
      const selected = options.find(w => w.uuid === choice)?.provider ?? options[0]?.provider ?? window.ethereum;
      if (!selected) throw new WalletActionError('Open this site in an Ethereum wallet browser, or enable a browser wallet, then connect again.');
      const accounts = await selected.request({ method: 'eth_requestAccounts' });
      if (!accounts[0]) throw new WalletActionError('No account was shared. Choose an account in your wallet and reconnect.');
      const chain = await selected.request({ method: 'eth_chainId' });
      active.current = true; setProvider(selected); setAddress(getAddress(accounts[0])); setChainId(Number(chain));
    } catch (err) { setError(walletError(err)); }
    finally { setConnecting(false); }
  }
  async function switchNetwork() {
    setError('');
    try {
      if (!provider) return;
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x1' }] });
      setChainId(Number(await provider.request({ method: 'eth_chainId' })));
    } catch (err) { setError(walletError(err)); }
  }
  function disconnect() { active.current = false; setAddress(undefined); setProvider(undefined); setChainId(undefined); setError(''); }
  return { options, choice, setChoice, provider, address, chainId, connecting, error, connect, switchNetwork, disconnect };
}
export type Wallet = ReturnType<typeof useWallet>;

export function useTransaction(wallet: Wallet, onConfirmed: () => void) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [hash, setHash] = useState<Hash>();
  const locked = useRef(false);
  const currentWallet = useRef(wallet);
  currentWallet.current = wallet;
  async function send(kind: 'mint' | 'reveal', input: number | number[]) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(''); setHash(undefined);
    setMessage('Checking the transaction…');
    try {
      if (!wallet.provider || !wallet.address) throw new WalletActionError('Connect a wallet to continue.');
      const client = createWalletClient({ chain: mainnet, transport: custom(wallet.provider) });
      const account = wallet.address;
      if (await client.getChainId() !== 1) throw new WalletActionError('Switch your wallet to Ethereum mainnet and try again.');
      let request;
      if (kind === 'mint') {
        const [stats, allocation] = await Promise.all([readStats(), readWalletAllowance(account)]);
        if (!stats.mintOpen) throw new WalletActionError('Minting is closed. Check back when the mint opens.');
        if (stats.owner.toLowerCase() === account.toLowerCase()) throw new WalletActionError('The contract owner cannot mint. Connect a different allowlisted wallet.');
        const amount = input as number;
        if (!Number.isInteger(amount) || amount < 1 || amount > allocation.remaining) throw new WalletActionError('Your allocation changed. Refresh and choose an available amount.');
        request = (await publicClient.simulateContract({ address: SWARM_ADDRESS, abi: swarmPepeAbi, functionName: 'claim', args: amount === allocation.remaining ? [] : [BigInt(amount)], account })).request;
      } else {
        const ids = [...new Set(input as number[])];
        if (!ids.length) throw new WalletActionError('Select at least one pending token.');
        request = (await publicClient.simulateContract({ address: SWARM_ADDRESS, abi: swarmPepeAbi, functionName: 'reveal', args: [ids.map(BigInt)], account })).request;
      }
      if (currentWallet.current.provider !== wallet.provider || currentWallet.current.address?.toLowerCase() !== account.toLowerCase()) throw new WalletActionError('The connected wallet changed. Review the account and try again.');
      const accounts = await client.getAddresses();
      if (accounts[0]?.toLowerCase() !== account.toLowerCase()) throw new WalletActionError('The wallet account changed. Review the connected account and try again.');
      setMessage('Confirm in your wallet. Network gas only.');
      const tx = await client.writeContract({ ...request, abi: swarmPepeAbi });
      setHash(tx); setMessage('Transaction sent. Waiting for Ethereum confirmation…');
      let replacementReason = '';
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx, timeout: 180_000, onReplaced: replacement => { replacementReason = replacement.reason; setHash(replacement.transaction.hash); } });
      if (replacementReason === 'cancelled') throw new WalletActionError('The transaction was cancelled in your wallet. No mint or reveal was completed.');
      if (receipt.status !== 'success') throw new WalletActionError('The transaction reverted. Refresh the contract state and try again.');
      if (kind === 'reveal') {
        const revealed = parseEventLogs({ abi: swarmPepeAbi, eventName: 'Revealed', logs: receipt.logs.filter(log => log.address.toLowerCase() === SWARM_ADDRESS.toLowerCase()) }).length;
        // A successful reveal can skip every ID. Never promise an image changed.
        setMessage(revealed ? `Reveal confirmed. ${revealed} token(s) revealed. Refreshing the collection.` : 'Reveal transaction confirmed. Unready, expired or already revealed tokens may have been skipped. Refreshing the collection.');
      } else {
        const minted = parseEventLogs({ abi: swarmPepeAbi, eventName: 'Minted', logs: receipt.logs.filter(log => log.address.toLowerCase() === SWARM_ADDRESS.toLowerCase()) }).filter(log => log.args.to?.toLowerCase() === account.toLowerCase()).length;
        setMessage(minted ? `Mint confirmed. ${minted} token(s) committed. Open the gallery to reveal after the next block.` : 'Transaction confirmed, but no mint to this wallet was found. Check the transaction on Etherscan before trying again.');
      }
      onConfirmed();
    } catch (err) {
      setError(walletError(err)); setMessage('');
    } finally { locked.current = false; setBusy(false); }
  }
  return { busy, message, error, hash, send };
}
