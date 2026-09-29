import { useEffect, useMemo, useState } from 'react';
import { type Token } from './chain';
import { type useCollection } from './useCollection';
import { PixelArt } from './components';
import { SWARM_ADDRESS } from './config';
import { type Wallet, useTransaction } from './wallet';

type Props = {
  collection: ReturnType<typeof useCollection>;
  wallet: Wallet;
  tx: ReturnType<typeof useTransaction>;
};

const PAGE_SIZE = 24;
const tokenNumber = (id: number) => `#${String(id).padStart(4, '0')}`;

export function Gallery({ collection, wallet, tx }: Props) {
  const [status, setStatus] = useState('all');
  const [traitType, setTraitType] = useState('');
  const [traitValue, setTraitValue] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const total = collection.stats?.totalMinted ?? 0;
  const tokenMap = useMemo(() => new Map<number, Token>(collection.tokens.map(token => [token.id, token])), [collection.tokens]);
  const pending = useMemo(() => collection.tokens.filter(token => token.seed === 0n).map(token => token.id), [collection.tokens]);
  const selectedPending = useMemo(() => pending.filter(id => selected.has(id)), [pending, selected]);
  const traitTypes = [...collection.rarity.keys()].sort();
  const traitValues = [...(collection.rarity.get(traitType)?.keys() ?? [])].sort();
  const filtered = useMemo(() => Array.from({ length: total }, (_, index) => index + 1).filter(id => {
    const token = tokenMap.get(id);
    if (status !== 'all' && (!token || (status === 'pending') !== (token.seed === 0n))) return false;
    if (traitType && traitValue && !token?.attributes.some(attribute => attribute.trait_type === traitType && String(attribute.value) === traitValue)) return false;
    return true;
  }), [total, tokenMap, status, traitType, traitValue]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const pageIds = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pagePending = pageIds.filter(id => tokenMap.get(id)?.seed === 0n);
  const connectedMainnet = !!wallet.address && wallet.chainId === 1 && !collection.loading && !collection.error;

  useEffect(() => { setPage(1); }, [status, traitType, traitValue]);

  function toggle(id: number) {
    setSelected(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function changePage(next: number) {
    setPage(next);
    const heading = document.getElementById('gallery-title');
    heading?.focus(); heading?.scrollIntoView({ block: 'start' });
  }
  function clearFilters() { setStatus('all'); setTraitType(''); setTraitValue(''); }
  function percent(type: string, value: string) {
    if (!collection.complete || total === 0) return 'Gathering';
    return `${(((collection.rarity.get(type)?.get(value) ?? 0) / total) * 100).toFixed(2)}%`;
  }

  return <section className="gallery-page" aria-labelledby="gallery-title">
    <div className="section-heading">
      <div><h1 id="gallery-title" tabIndex={-1}>The swarm is many.</h1><p className="muted">Every minted Pepe. Read directly from Ethereum.</p></div>
      <div className="control-row"><span className="gallery-count">{collection.stats ? `${total.toLocaleString()} minted` : 'Reading supply…'}</span><button onClick={collection.refresh} disabled={collection.loading || tx.busy}>Refresh collection</button></div>
    </div>

    <div className="scan-progress" role="status">
      {collection.complete
        ? `All ${total.toLocaleString()} token records read. Trait percentages use the full minted collection.`
        : `${collection.loadingTokens ? 'Reading' : 'Read'} on-chain records: ${collection.progress.loaded.toLocaleString()} / ${total.toLocaleString()}. Trait percentages appear when every record is read.`}
    </div>
    {collection.tokenError && <div className="notice" role="alert"><p>{collection.tokenErrors} token records could not be read. {collection.tokenError}</p><button className="button" type="button" onClick={collection.retryTokens} disabled={collection.loadingTokens}>Retry missing tokens</button></div>}

    <div className="filters">
      <label className="field">Token status
        <select value={status} onChange={event => setStatus(event.target.value)}>
          <option value="all">All minted</option><option value="revealed">Revealed</option><option value="pending">Pending</option>
        </select>
      </label>
      <label className="field">Trait
        <select value={traitType} disabled={!collection.complete} onChange={event => { setTraitType(event.target.value); setTraitValue(''); }}>
          <option value="">All traits</option>{traitTypes.map(type => <option key={type} value={type}>{type}</option>)}
        </select>
      </label>
      <label className="field">Trait value
        <select value={traitValue} disabled={!collection.complete || !traitType} onChange={event => setTraitValue(event.target.value)}>
          <option value="">All values</option>{traitValues.map(value => <option key={value} value={value}>{value} · {percent(traitType, value)}</option>)}
        </select>
      </label>
      {(status !== 'all' || traitType) && <button className="button" type="button" onClick={clearFilters}>Clear filters</button>}
    </div>

    <details className="reveal-panel" open={status === 'pending' || selectedPending.length > 0}>
      <summary>Reveal the swarm · {pending.length.toLocaleString()} pending{!collection.complete ? ' found so far' : ''}</summary>
      <p>Anyone can reveal anyone’s tokens. Select pending IDs and send one batch. Tokens that are not ready or already revealed are skipped.</p>
      <p className="muted">If a large batch exceeds the network gas limit, select fewer tokens. Reveal after the next block and within about 27 hours of minting. After the block-history window expires, a token may stay pending permanently. A successful transaction can skip every ID. Network gas applies.</p>
      <div className="control-row">
        <button className="button" type="button" disabled={!pagePending.length || tx.busy} onClick={() => setSelected(current => new Set([...current, ...pagePending]))}>Select pending on page</button>
        <button className="button" type="button" disabled={!selectedPending.length || tx.busy} onClick={() => setSelected(new Set())}>Clear selection</button>
        <button className="button" type="button" disabled={!collection.complete || !pending.length || tx.busy} onClick={() => setSelected(new Set(pending))}>Select all pending</button>
      </div>
      <p role="status">{selectedPending.length.toLocaleString()} selected across all pages.</p>
      {!wallet.address && wallet.options.length > 1 && <label className="field">Choose a wallet<select value={wallet.choice} onChange={event => wallet.setChoice(event.target.value)}>{wallet.options.map(option => <option value={option.uuid} key={option.uuid}>{option.name}</option>)}</select></label>}
      {!wallet.address && <div className="control-row"><button className="button" type="button" onClick={wallet.connect} disabled={wallet.connecting}>{wallet.connecting ? 'Connecting…' : 'Connect wallet to reveal'}</button><span className="muted">Reading the collection never needs a wallet.</span></div>}
      {wallet.address && wallet.chainId !== 1 && <button className="button" type="button" onClick={wallet.switchNetwork}>Switch to Ethereum mainnet</button>}
      <div className="control-row">
        <button className="button primary" type="button" disabled={!connectedMainnet || !selectedPending.length || tx.busy} onClick={() => void tx.send('reveal', selectedPending)}>{tx.busy ? 'Transaction in progress…' : `Reveal selected (${selectedPending.length})`}</button>
        <button className="button" type="button" disabled={!connectedMainnet || !collection.complete || !pending.length || tx.busy} onClick={() => void tx.send('reveal', pending)}>Reveal all pending ({pending.length})</button>
      </div>
      {!collection.complete && <p className="muted">Reveal all becomes available after every minted token is checked.</p>}
      {collection.complete && !pending.length && <p>No pending tokens. The whole minted swarm is revealed.</p>}
    </details>

    <div className="control-row">{pages > 1 && <label className="page-jump">Go to page<select value={currentPage} onChange={event => setPage(Number(event.target.value))}>{Array.from({length: pages}, (_, index) => <option key={index + 1} value={index + 1}>{index + 1} / {pages}</option>)}</select></label>}</div>
    <p className="muted" role="status">{filtered.length.toLocaleString()} {status === 'all' ? 'tokens' : `${status} tokens`}{!collection.complete && status !== 'all' ? ' found so far' : ''}{traitValue ? ` matching ${traitType}: ${traitValue}` : ''}.</p>
    {filtered.length === 0
      ? <div className="notice"><p>{!collection.stats ? 'Waiting for the live minted total from Ethereum.' : total === 0 ? 'No minted tokens are available yet. Refresh the collection to check again.' : !collection.complete ? 'No matching records have loaded yet. Complete the collection read or retry missing tokens.' : 'No tokens match these filters.'}</p>{(status !== 'all' || traitType) && <button className="button" type="button" onClick={clearFilters}>Clear filters</button>}</div>
      : <div className="gallery-grid">{pageIds.map(id => {
        const token = tokenMap.get(id);
        return <article className={`token-card${selected.has(id) && token?.seed === 0n ? ' selected' : ''}`} key={id} aria-label={`Swarm Pepe ${tokenNumber(id)}`}>
          {token ? <PixelArt token={token} /> : <div className="art-placeholder"><span>{collection.loadingTokens ? 'Reading on-chain art…' : 'Art not loaded. Retry missing tokens.'}</span></div>}
          <div className="token-meta"><h2 className="token-number">{tokenNumber(id)}</h2><span className="token-status">{token ? token.seed === 0n ? 'Pending' : 'Revealed' : 'Reading'}</span></div>
          {token?.seed === 0n && <label className="selection-control"><input type="checkbox" checked={selected.has(id)} onChange={() => toggle(id)} disabled={tx.busy} />Select {tokenNumber(id)} to reveal</label>}
          {token && <details className="token-traits"><summary>View traits · {token.attributes.length}</summary><dl className="trait-list">{token.attributes.map(attribute => <div key={`${attribute.trait_type}:${attribute.value}`}><dt>{attribute.trait_type}</dt><dd>{String(attribute.value)}<span className="muted"> · {percent(attribute.trait_type, String(attribute.value))}</span></dd></div>)}</dl><p className="muted">{collection.complete ? '% of all minted tokens. Pending metadata is included.' : 'Percentages are gathering from the complete collection.'}</p></details>}
          <div className="card-actions"><a href={`https://opensea.io/assets/ethereum/${SWARM_ADDRESS}/${id}`} target="_blank" rel="noreferrer" aria-label={`View Swarm Pepe ${tokenNumber(id)} on OpenSea`}>OpenSea ↗</a><a href={`https://etherscan.io/nft/${SWARM_ADDRESS}/${id}`} target="_blank" rel="noreferrer" aria-label={`View Swarm Pepe ${tokenNumber(id)} on Etherscan`}>Etherscan ↗</a></div>
        </article>;
      })}</div>}
    {filtered.length > PAGE_SIZE && <nav className="pagination" aria-label="Gallery pages">
      <button className="button" type="button" disabled={currentPage === 1} onClick={() => changePage(currentPage - 1)}>Previous page</button>
      <span role="status">Page {currentPage} / {pages}</span>
      <button className="button" type="button" disabled={currentPage === pages} onClick={() => changePage(currentPage + 1)}>Next page</button>
    </nav>}
  </section>;
}
