export function EvidenceChain() {
  return (
    <div className="evidenceGraph" aria-label="Evidence chain illustration">
      <div className="node claimNode">
        <span>CLAIM C-014</span>
        <strong>Independent support?</strong>
      </div>
      <div className="graphStem" />
      <div className="graphBranches">
        <div className="branch">
          <div className="node sourceNode">
            <span>Study A</span>
            <strong>Primary dataset</strong>
          </div>
          <div className="node originNode">Dataset X</div>
        </div>
        <div className="branch duplicate">
          <div className="node sourceNode">
            <span>Article B + C</span>
            <strong>Shared origin</strong>
          </div>
          <div className="node originNode">Reuters → Report Y</div>
        </div>
        <div className="branch">
          <div className="node sourceNode">
            <span>Archive D</span>
            <strong>Independent</strong>
          </div>
          <div className="node originNode">Original record</div>
        </div>
      </div>
      <p className="graphCaption">
        4 URLs → <strong>3 independent information chains</strong>
      </p>
    </div>
  );
}
