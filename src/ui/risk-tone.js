export function riskTone(risk) {
  if (risk === 'SAFE') return 'good';
  if (risk === 'LOW RISK' || risk === 'SUSPICIOUS') return 'warn';
  if (risk === 'HIGH RISK' || risk === 'KNOWN MALICIOUS' || risk === 'USER BLOCKED') return 'danger';
  return 'neutral';
}
