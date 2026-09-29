import { parseAbi } from 'viem'

/** Minimal UI ABI, checked against both contracts' verified sources.
 * Provenance and reveal-window details: artifacts/contract-research.md.
 */
export const swarmPepeAbi = parseAbi([
  'function totalMinted() view returns (uint256)',
  'function MAX_SUPPLY() view returns (uint256)',
  'function MAX_PER_WALLET() view returns (uint256)',
  'function mintOpen() view returns (bool)',
  'function owner() view returns (address)',
  'function ART() view returns (address)',
  'function allowance(address) view returns (uint256)',
  'function minted(address) view returns (uint256)',
  'function remaining(address account) view returns (uint256)',
  'function seedOf(uint256) view returns (uint256)',
  'function revealableAt(uint256 tokenId) view returns (uint256)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function claim()',
  'function claim(uint256 amount)',
  'function reveal(uint256[] tokenIds)',
  'error MintClosed()',
  'error NotAllowlisted()',
  'error AllowanceExceeded()',
  'error WalletCapExceeded()',
  'error SupplyExceeded()',
  'error OwnerCannotMint()',
  'error ZeroAmount()',
  'error ZeroAddress()',
  'error LengthMismatch()',
  'error ERC721NonexistentToken(uint256 tokenId)',
  'event Minted(address indexed to, uint256 indexed tokenId, uint256 mintBlock)',
  'event Revealed(uint256 indexed tokenId, uint256 seed)',
])

export const pixelArtAbi = parseAbi([
  'function renderSVG(uint256 seed) pure returns (string)',
  'function attributes(uint256 seed) pure returns (string)',
  'function placeholderSVG() pure returns (string)',
])
