import { useEffect, useRef, useState, type FormEvent } from 'react';
import { isAddress, type Address } from 'viem';
import { useCollection } from './useCollection';
import { formatContractError, readWalletAllowance, type Token } from './chain';
import { OPENSEA_URL, X_URL, SWARM_ADDRESS, RENDERER_ADDRESS } from './config';
import { useWallet, useTransaction, type Wallet } from './wallet';
import { ExternalLink, PixelArt } from './components';
import { Gallery } from './Gallery';

type Tab = 'home' | 'gallery' | 'about';
const readTab = (): Tab => ['gallery', 'about'].includes(location.hash.slice(1)) ? location.hash.slice(1) as Tab : 'home';
type Allocation = Awaited<ReturnType<typeof readWalletAllowance>>;

function WalletControl({ wallet }: { wallet: Wallet }) {
  if (wallet.address) return <div className="wallet-control"><span className="wallet-address" title={wallet.address}>{wallet.address.slice(0, 6)}…{wallet.address.slice(-4)}</span><button onClick={wallet.disconnect} className="compact">Disconnect</button></div>;
  return <button className="wallet-connect" onClick={wallet.connect} disabled={wallet.connecting}>{wallet.connecting ? 'Connecting…' : 'Connect wallet'}<span aria-hidden="true"> ↗</span></button>;
}

function Allowlist({ wallet, stats, refreshKey, tx, blocked }: {
  wallet: Wallet; stats: ReturnType<typeof useCollection>['stats']; refreshKey: string;
  tx: ReturnType<typeof useTransaction>; blocked: boolean;
}) {
  const [input, setInput] = useState('');
  const [checked, setChecked] = useState<{ address: string; data: Allocation }>();
  const [fieldError, setFieldError] = useState('');
  const [checking, setChecking] = useState(false);
  const [walletAllocation, setWalletAllocation] = useState<Allocation>();
  const [allocationError, setAllocationError] = useState('');
  const [amount, setAmount] = useState('all');
  const [walletReadVersion, setWalletReadVersion] = useState(0);
  const field = useRef<HTMLInputElement>(null);
  const requestVersion = useRef(0);
  useEffect(() => {
    let cancelled = false;
    setWalletAllocation(undefined); setAllocationError(''); setAmount('all');
    if (wallet.address) readWalletAllowance(wallet.address).then(data => {
      if (!cancelled) setWalletAllocation(data);
    }).catch(err => { if (!cancelled) setAllocationError(formatContractError(err)); });
    return () => { cancelled = true; };
  }, [wallet.address, refreshKey, walletReadVersion]);
  useEffect(() => () => { requestVersion.current++; }, []);
  async function check(event: FormEvent) {
    event.preventDefault();
    const address = input.trim();
    setChecked(undefined); setFieldError('');
    if (!isAddress(address, { strict: false })) {
      setFieldError('Enter a complete Ethereum address: 0x followed by 40 hexadecimal characters.');
      field.current?.focus(); return;
    }
    const version = ++requestVersion.current;
    setChecking(true);
    try {
      const data = await readWalletAllowance(address as Address);
      if (version === requestVersion.current) setChecked({ address, data });
    } catch (err) { if (version === requestVersion.current) setFieldError(formatContractError(err)); }
    finally { if (version === requestVersion.current) setChecking(false); }
  }
  const owner = wallet.address && stats?.owner.toLowerCase() === wallet.address.toLowerCase();
  const reason = blocked ? 'Live contract state is unavailable. Retry the connection above.'
    : !stats ? 'Reading mint status from Ethereum…'
    : !stats.mintOpen ? 'Minting is closed. Check back when the mint opens.'
    : stats.totalMinted >= stats.maxSupply ? 'All 5,000 tokens have been minted.'
    : !wallet.address ? 'Connect an allowlisted wallet to mint.'
    : wallet.chainId !== 1 ? 'Switch your wallet to Ethereum mainnet to mint.'
    : owner ? 'The contract owner cannot mint. Connect a different allowlisted wallet.'
    : allocationError ? 'Could not read this wallet’s slots. Retry the wallet check.'
    : !walletAllocation ? 'Checking your wallet’s allocation…'
    : walletAllocation.remaining === 0 ? 'This wallet has no mint slots left.' : '';
  const selected = amount === 'all' ? walletAllocation?.remaining ?? 0 : Number(amount);
  return <section className="mint-section" id="mint" aria-labelledby="mint-heading">
    <div className="mint-intro">
      <h2 id="mint-heading">Your signal.<br /><span className="accent">Your Pepe.</span></h2>
      <p>Wallets are picked for the requests they send the swarm. Slots are earned, never sold.</p>
      <p className="muted small">No mint price. Ethereum network gas applies.<br />Up to 3 Pepes per wallet.</p>
      <a className="text-link" href="#about">How the collection works <span aria-hidden="true">↗</span></a>
    </div>
    <div className="mint-panel">
      <div className="panel-title"><h3>Check your allocation</h3><span className={`status ${stats?.mintOpen ? 'accent' : 'orange'}`}>{stats ? stats.mintOpen ? 'Mint open' : 'Mint closed' : 'Reading…'}</span></div>
      <form onSubmit={check} noValidate>
        <label htmlFor="check-address">Ethereum address</label>
        <div className="address-row"><input ref={field} id="check-address" name="address" placeholder="0x…" autoComplete="off" autoCapitalize="none" spellCheck={false} value={input} aria-invalid={!!fieldError} aria-describedby={fieldError ? 'address-error' : 'address-help'} onChange={event => { setInput(event.target.value); setFieldError(''); setChecked(undefined); requestVersion.current++; setChecking(false); }} /><button disabled={checking} type="submit">{checking ? 'Checking…' : 'Check slots'}</button></div>
        <p className="muted small" id="address-help">Paste any address. No wallet connection needed.</p>
        {fieldError && <p className="error small" id="address-error" role="alert">{fieldError}</p>}
        <div role="status" className="checker-result">{checked && <><p className="small">Checked <span className="break-address">{checked.address}</span></p><AllocationStats data={checked.data} /><p className={checked.data.remaining ? 'accent' : 'orange'}>{stats?.owner.toLowerCase() === checked.address.toLowerCase() ? 'This address is the contract owner and cannot mint.' : checked.data.remaining ? `${checked.data.remaining} mint ${checked.data.remaining === 1 ? 'slot' : 'slots'} left.` : 'This wallet has no mint slots left.'}</p></>}</div>
      </form>
      <div className="mint-action">
        <div className="panel-title"><h3>Mint your Pepe</h3><span className="muted small">01 / Commit</span></div>
        {wallet.options.length > 1 && !wallet.address && <label className="wallet-select">Choose a wallet<select value={wallet.choice} onChange={e => wallet.setChoice(e.target.value)}>{wallet.options.map(option => <option value={option.uuid} key={option.uuid}>{option.name}</option>)}</select></label>}
        {wallet.address && <p className="small">Connected <span className="break-address">{wallet.address}</span></p>}
        {walletAllocation && wallet.address && <AllocationStats data={walletAllocation} />}
        {allocationError && <div className="notice"><p>{allocationError}</p><button onClick={() => setWalletReadVersion(v => v + 1)}>Retry wallet check</button></div>}
        {wallet.address && wallet.chainId !== 1 && <button onClick={wallet.switchNetwork}>Switch to Ethereum</button>}
        <div className="mint-controls">
          <label htmlFor="mint-amount">Amount<select id="mint-amount" value={amount} disabled={!!reason || tx.busy} onChange={e => setAmount(e.target.value)}><option value="all">All remaining{walletAllocation ? ` (${walletAllocation.remaining})` : ''}</option>{Array.from({ length: Math.max(0, (walletAllocation?.remaining ?? 0) - 1) }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} Pepe{i ? 's' : ''}</option>)}</select></label>
          {wallet.address ? <button className="primary mint-button" disabled={!!reason || tx.busy} aria-describedby="mint-reason" onClick={() => tx.send('mint', selected)}>{tx.busy ? 'Transaction in progress…' : 'Mint'}<span aria-hidden="true"> ↗</span></button> : <button className="primary mint-button" disabled={wallet.connecting} onClick={wallet.connect}>{wallet.connecting ? 'Connecting…' : 'Connect to mint'}<span aria-hidden="true"> ↗</span></button>}
        </div>
        <p className="muted small" id="mint-reason">{reason || `Ready to mint ${selected} ${selected === 1 ? 'Pepe' : 'Pepes'}. Art is revealed in a separate transaction.`}</p>
      </div>
    </div>
  </section>;
}
function AllocationStats({ data }: { data: Allocation }) {
  return <dl className="allocation-stats"><div><dt>Allowance</dt><dd>{data.allowance}</dd></div><div><dt>Minted</dt><dd>{data.minted}</dd></div><div><dt>Slots left</dt><dd className="accent">{data.remaining}</dd></div></dl>;
}

function Showcase({ token, hero = false }: { token: Token; hero?: boolean }) {
  return <article className={`token-card showcase-card ${hero ? 'hero-card' : ''}`}>
    <PixelArt token={token} hero={hero} />
    <div className="token-meta"><span className="token-id">#{String(token.id).padStart(4, '0')}</span><span className="muted small">{token.revealed ? 'Revealed' : 'Pending'}</span></div>
    {hero && <div className="hero-traits">{token.attributes.slice(0, 3).map(trait => <span key={trait.trait_type}>{trait.value}</span>)}</div>}
  </article>;
}

function About() {
  return <section className="about-page"><div className="about-title"><h1>One seed.<br /><span className="accent">One Pepe.</span></h1><div className="code-mark" aria-hidden="true">[ 24 × 24 ]<br />∞ ON CHAIN</div></div>
    <div className="about-copy">
      <p>5,000 on-chain pixel Pepes. The contract draws the art itself, pixel by pixel, and stores it on Ethereum. The artwork and metadata come straight from the contracts. No images are hosted anywhere.</p>
      <p>Mint first, reveal second. Each mint commits to a fixed future block: the block immediately after the mint. That block did not exist when the mint was sent, so the minter could not grind known outcomes. Once revealed, the seed and art are fixed.</p>
      <p>Anyone can reveal anyone else’s token. The contract skips tokens that are not ready or already revealed. Reveal promptly: Ethereum’s block-hash history lasts 8,191 blocks, roughly 27 hours. Beyond that window, a pending token can remain unrevealed; the contract never switches to a new random block.</p>
      <p>Wallets get on the list for the requests they send the swarm. Slots are not sold. Each wallet can mint up to three Pepes, and the contract owner cannot mint. There is no mint price; Ethereum network gas still applies.</p>
      <p>Read the code, follow the swarm, or explore the collection. Everything that makes a Pepe a Pepe lives in these two verified contracts.</p>
      <div className="contract-links"><ExternalLink href={`https://etherscan.io/address/${SWARM_ADDRESS}#code`}>SwarmPepe / ERC-721<span className="break-address">{SWARM_ADDRESS}</span></ExternalLink><ExternalLink href={`https://etherscan.io/address/${RENDERER_ADDRESS}#code`}>PixelArt / Renderer<span className="break-address">{RENDERER_ADDRESS}</span></ExternalLink></div>
      <div className="about-social"><ExternalLink href={OPENSEA_URL}>OpenSea collection</ExternalLink><ExternalLink href={X_URL}>Swarm Pepe on X</ExternalLink></div>
    </div>
  </section>;
}

export default function App() {
  const [tab, setTab] = useState<Tab>(readTab);
  const collection = useCollection(tab === 'gallery');
  const wallet = useWallet();
  const tx = useTransaction(wallet, collection.refresh);
  const main = useRef<HTMLElement>(null);
  const initialHash = useRef(true);
  useEffect(() => {
    const change = () => { setTab(readTab()); initialHash.current = false; };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  useEffect(() => {
    document.title = `Swarm Pepe — ${tab.charAt(0).toUpperCase() + tab.slice(1)}`;
    if (!initialHash.current) { main.current?.focus(); window.scrollTo(0, 0); }
  }, [tab]);
  const revealed = collection.tokens.filter(token => token.revealed);
  const featured = revealed[0];
  const stats = collection.stats;
  return <>
    <a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); main.current?.focus(); }}>Skip to content</a>
    <div className="viewport-frame" aria-hidden="true" />
    <header className="hud-header"><a className="wordmark" href="#home">Swarm <span>/</span> Pepe</a><div className="network-status"><span className={`live-dot ${collection.error ? 'offline' : !stats || collection.loading ? 'waiting' : ''}`} aria-hidden="true" />Ethereum mainnet<span className="network-state"> / {collection.error ? 'RPC offline' : collection.loading ? 'Syncing' : 'Live'}</span></div></header>
    <div className="nav-bar"><nav aria-label="Main navigation">{(['home', 'gallery', 'about'] as Tab[]).map((item, i) => <a key={item} href={`#${item}`} aria-current={tab === item ? 'page' : undefined}><span className="nav-number">0{i + 1}</span> {item}</a>)}</nav><WalletControl wallet={wallet} /></div>
    <main id="main-content" tabIndex={-1} ref={main}>
      <div className="global-status" role="status">{collection.loading && !stats ? 'Connecting to Ethereum. Reading the collection…' : ''}</div>
      {collection.error && <div className="notice error" role="alert"><div><strong>Ethereum connection unavailable</strong><p>{collection.error} Any previously loaded data may be out of date.</p></div><button onClick={collection.refresh} disabled={collection.loading}>Retry connection</button></div>}
      {wallet.error && <div className="notice error" role="alert">{wallet.error}</div>}
      <div className="transaction-status" role="status">{tx.message && <p>{tx.message}</p>}{tx.hash && <ExternalLink href={`https://etherscan.io/tx/${tx.hash}`}>View transaction on Etherscan</ExternalLink>}</div>
      {tx.error && <div className="notice error" role="alert"><p>{tx.error}</p>{tx.hash && <p>Check the transaction on Etherscan before sending another transaction.</p>}</div>}
      {tab === 'home' && <>
        {collection.tokenError && <div className="notice" role="alert"><p>{collection.tokenError}</p><button onClick={collection.retryTokens} disabled={collection.loadingTokens}>Retry missing artwork</button></div>}
        <section className="hero">
          <div className="hero-copy"><h1>Swarm<br /><span className="accent">Pepe</span><span className="hero-period">.</span></h1><div className="orange-rule" /><h2>On chain.<br />Pixel by pixel.</h2><p>5,000 generative portraits.<br />Drawn by code. Picked by the swarm.<br />Stored on Ethereum. Forever.</p><a className="text-link" href="#gallery">Explore the collection <span aria-hidden="true">↗</span></a>
            <div className="supply"><div className="supply-label"><span>Total minted</span><button className="text-button" onClick={collection.refresh} disabled={collection.loading} aria-label="Refresh contract data">{collection.loading ? 'Reading…' : 'Refresh ↻'}</button></div><div className="supply-value"><span>{stats ? stats.totalMinted.toLocaleString('en-US') : '—'}</span><span className="supply-max"> / {stats ? stats.maxSupply.toLocaleString('en-US') : '5,000'}</span></div><div className="supply-track" aria-hidden="true"><span style={{ width: `${stats ? stats.totalMinted / stats.maxSupply * 100 : 0}%` }} /></div><p className="small muted">{stats ? `Read at block ${stats.blockNumber.toLocaleString('en-US')}` : 'Awaiting live contract data'}</p></div>
          </div>
          <div className="hero-visual">{featured ? <Showcase token={featured} hero /> : <div className="art-loading"><span className="pixel-cross" aria-hidden="true">+</span><p>{collection.error || collection.tokenErrors ? 'Artwork unavailable' : collection.loadingTokens || !stats ? 'Reading on-chain artwork…' : 'No revealed tokens yet'}</p><p className="muted small">{collection.error || collection.tokenErrors ? 'Retry the Ethereum connection to load the real art.' : 'Every portrait is read from tokenURI().'}</p>{collection.tokenErrors > 0 && <button onClick={collection.retryTokens}>Retry artwork</button>}</div>}<div className="visual-meta"><span>24 × 24 pixels</span><span>100% on chain</span></div></div>
        </section>
        <section className="signals-section" aria-labelledby="signals-heading"><div className="section-heading"><h2 id="signals-heading">The first signals</h2><a className="text-link" href="#gallery">View gallery <span aria-hidden="true">↗</span></a></div>{revealed.length > 1 ? <div className="showcase-grid">{revealed.slice(1, 5).map(token => <Showcase token={token} key={token.id} />)}</div> : <p className="muted">{collection.loadingTokens ? 'Reading revealed tokens from Ethereum…' : 'Revealed portraits appear here once available.'}</p>}<p className="small accent">One seed. One distinct Pepe.</p></section>
        <Allowlist wallet={wallet} stats={stats} refreshKey={stats?.blockNumber.toString() ?? ''} tx={tx} blocked={!!collection.error} />
      </>}
      {tab === 'gallery' && <Gallery collection={collection} wallet={wallet} tx={tx} />}
      {tab === 'about' && <About />}
    </main>
    <footer className="hud-footer"><span>Spepe <span className="footer-divider">/</span> <span className="footer-description">On chain · 24 × 24</span></span><div><ExternalLink href={OPENSEA_URL}>OpenSea</ExternalLink><ExternalLink href={X_URL}>X / Swarmpepes</ExternalLink></div><span className="footer-end">Made of pixels. Built to stay.</span></footer>
  </>;
}
