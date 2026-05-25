function adapterDiagnostics(extra = {}) {
  return {
    warnings: [],
    repairedFields: [],
    droppedFields: [],
    rawResponseStored: false,
    ...extra
  };
}

function adapterOutput({
  provider,
  providerModel = 'unknown',
  rawShapeVersion = 'unknown',
  issue,
  diagnostics = {}
}) {
  return {
    provider,
    providerModel,
    rawShapeVersion,
    issue,
    adapterDiagnostics: adapterDiagnostics(diagnostics)
  };
}

module.exports = {
  adapterDiagnostics,
  adapterOutput
};
