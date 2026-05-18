const AREAS = Object.freeze([
  { label: '80 KM', domain: 'PHN' },
  { label: '240 KM', domain: '240KM' },
  { label: '450 KM', domain: 'CAMBODIA' }
]);

const ALLOWED_DOMAINS = new Set(AREAS.map((area) => area.domain));

function isValidDomain(domain) {
  return ALLOWED_DOMAINS.has(domain);
}

function assertValidDomain(domain) {
  if (!isValidDomain(domain)) {
    throw new Error(`Invalid radar domain: ${String(domain)}`);
  }
}

module.exports = {
  AREAS,
  ALLOWED_DOMAINS,
  isValidDomain,
  assertValidDomain
};
