import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  decodeErrorResult,
  http,
  type Address,
  type Hex,
} from 'viem'
import { mainnet } from 'viem/chains'
import { swarmPepeAbi } from './abi'
import { RPC_URL, SWARM_ADDRESS } from './config'

export const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(RPC_URL, { timeout: 18_000, retryCount: 1, retryDelay: 800 }),
})

const contract = { address: SWARM_ADDRESS, abi: swarmPepeAbi } as const

export interface CollectionStats {
  totalMinted: number
  maxSupply: number
  mintOpen: boolean
  owner: Address
  blockNumber: bigint
}

export interface WalletAllowance {
  allowance: number
  minted: number
  remaining: number
  blockNumber: bigint
}

export interface Attribute {
  trait_type: string
  value: string
}

export interface Token {
  id: number
  name: string
  image: string
  attributes: Attribute[]
  seed: bigint
  revealed: boolean
}

export async function readStats(): Promise<CollectionStats> {
  const blockNumber = await publicClient.getBlockNumber({ cacheTime: 0 })
  const [totalMinted, maxSupply, mintOpen, owner] = await publicClient.multicall({
    contracts: [
      { ...contract, functionName: 'totalMinted' },
      { ...contract, functionName: 'MAX_SUPPLY' },
      { ...contract, functionName: 'mintOpen' },
      { ...contract, functionName: 'owner' },
    ],
    allowFailure: false,
    blockNumber,
  })
  if (totalMinted > maxSupply || maxSupply > 5_000n) {
    throw new Error('The RPC returned an unexpected collection supply. Try refreshing.')
  }
  return { totalMinted: Number(totalMinted), maxSupply: Number(maxSupply), mintOpen, owner, blockNumber }
}

export async function readWalletAllowance(address: Address): Promise<WalletAllowance> {
  const blockNumber = await publicClient.getBlockNumber({ cacheTime: 0 })
  const [allowance, minted, remaining] = await publicClient.multicall({
    contracts: [
      { ...contract, functionName: 'allowance', args: [address] },
      { ...contract, functionName: 'minted', args: [address] },
      { ...contract, functionName: 'remaining', args: [address] },
    ],
    allowFailure: false,
    blockNumber,
  })
  return { allowance: Number(allowance), minted: Number(minted), remaining: Number(remaining), blockNumber }
}

/** A bounded, inexpensive seed scan lets Home find real revealed art without downloading the collection. */
export async function readSeeds(ids: number[], blockNumber: bigint): Promise<Map<number, bigint>> {
  if (ids.length > 64) throw new Error('Read seeds in batches of at most 64.')
  const values = await publicClient.multicall({
    contracts: ids.map(id => ({ ...contract, functionName: 'seedOf' as const, args: [BigInt(id)] as const })),
    allowFailure: false,
    blockNumber,
    batchSize: 0,
  })
  return new Map(ids.map((id, index) => [id, values[index]]))
}

function decodeBase64(value: string): string {
  const bytes = Uint8Array.from(atob(value), character => character.charCodeAt(0))
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

/** Only the two inline data URI formats emitted by the verified contract are accepted. */
export function parseTokenURI(uri: string, id: number, seed: bigint): Token {
  const prefix = 'data:application/json;base64,'
  if (!uri.startsWith(prefix) || uri.length > 2_000_000) {
    throw new Error(`Token #${id} returned an unsupported on-chain metadata format.`)
  }
  const metadata: unknown = JSON.parse(decodeBase64(uri.slice(prefix.length)))
  if (!metadata || typeof metadata !== 'object') throw new Error(`Token #${id} has invalid metadata.`)
  const data = metadata as Record<string, unknown>
  if (typeof data.image !== 'string' || !/^data:image\/svg\+xml;base64,[A-Za-z0-9+/]+=*$/.test(data.image)) {
    throw new Error(`Token #${id} did not return an inline SVG.`)
  }
  if (!Array.isArray(data.attributes)) throw new Error(`Token #${id} has invalid traits.`)
  const attributes: Attribute[] = data.attributes.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object') throw new Error(`Token #${id} has an invalid trait.`)
    const item = entry as Record<string, unknown>
    if (typeof item.trait_type !== 'string' || !['string', 'number'].includes(typeof item.value)) {
      throw new Error(`Token #${id} has an invalid trait.`)
    }
    return { trait_type: item.trait_type, value: String(item.value) }
  })
  return {
    id,
    name: typeof data.name === 'string' ? data.name : `Swarm Pepe #${id}`,
    image: data.image,
    attributes,
    seed,
    revealed: seed !== 0n,
  }
}

export async function readToken(id: number, blockNumber: bigint, knownSeed?: bigint): Promise<Token> {
  if (knownSeed !== undefined) {
    const uri = await publicClient.readContract({ ...contract, functionName: 'tokenURI', args: [BigInt(id)], blockNumber })
    return parseTokenURI(uri, id, knownSeed)
  }
  // Each worker makes one request; never combine dozens of expensive SVG renders into one eth_call.
  const [seed, uri] = await publicClient.multicall({
    contracts: [
      { ...contract, functionName: 'seedOf', args: [BigInt(id)] },
      { ...contract, functionName: 'tokenURI', args: [BigInt(id)] },
    ],
    allowFailure: false,
    blockNumber,
    batchSize: 0,
  })
  return parseTokenURI(uri, id, seed)
}

const contractMessages: Record<string, string> = {
  MintClosed: 'Minting is closed. The collection owner has not opened this mint.',
  NotAllowlisted: 'This wallet is not on the allowlist. It has no mint slots.',
  AllowanceExceeded: 'That amount exceeds the slots left for this wallet. Refresh your allowance.',
  WalletCapExceeded: 'A wallet can mint at most 3 Swarm Pepes in total.',
  SupplyExceeded: 'That amount exceeds the remaining collection supply. Refresh and try a smaller amount.',
  OwnerCannotMint: 'The contract owner cannot mint. Connect a different allowlisted wallet.',
  ZeroAmount: 'There are no slots left to mint, or the selected amount is zero.',
  ZeroAddress: 'The contract cannot use the zero address.',
  LengthMismatch: 'The contract received mismatched input lengths.',
}

export function formatContractError(error: unknown): string {
  if (error instanceof BaseError) {
    const reverted = error.walk(item => item instanceof ContractFunctionRevertedError)
    if (reverted instanceof ContractFunctionRevertedError && reverted.data?.errorName) {
      const message = contractMessages[reverted.data.errorName]
      if (message) return message
    }
  }
  // Wallets expose nested errors in several formats, including raw custom-error selectors.
  let candidate: unknown = error
  const seen = new Set<unknown>()
  let combined = ''
  while (candidate && typeof candidate === 'object' && !seen.has(candidate)) {
    seen.add(candidate)
    const details = candidate as Record<string, unknown>
    if (details.code === 4001 || details.code === 'ACTION_REJECTED') return 'Request cancelled in your wallet. Nothing was sent.'
    if (details.code === -32002) return 'A request is already waiting in your wallet. Open it to continue.'
    if (typeof details.message === 'string') combined += ` ${details.message}`
    if (typeof details.data === 'string' && details.data.startsWith('0x')) {
      try {
        const decoded = decodeErrorResult({ abi: swarmPepeAbi, data: details.data as Hex })
        if (contractMessages[decoded.errorName]) return contractMessages[decoded.errorName]
      } catch { /* Not a contract error payload. */ }
    }
    candidate = details.cause ?? details.error ?? details.originalError ?? (typeof details.data === 'object' ? details.data : undefined)
  }
  for (const [name, message] of Object.entries(contractMessages)) {
    if (combined.includes(name)) return message
  }
  if (/user rejected|user denied/i.test(combined)) return 'Request cancelled in your wallet. Nothing was sent.'
  if (/insufficient funds/i.test(combined)) return 'This wallet needs ETH to pay Ethereum network gas.'
  if (/chain mismatch|chainmismatch|network mismatch|wrong network|unsupported chain|chain.*does not match/i.test(combined)) {
    return 'Switch your wallet to Ethereum mainnet and try again.'
  }
  if (/fetch|network|timeout|HTTP|rate limit|429|RPC/i.test(combined)) {
    return 'The Ethereum RPC could not complete this request. Wait a moment, then retry.'
  }
  return 'The request could not be completed. Refresh the chain data and try again.'
}
