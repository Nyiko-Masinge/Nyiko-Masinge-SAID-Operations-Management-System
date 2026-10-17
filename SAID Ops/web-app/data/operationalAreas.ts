// Legacy WS2 demo fixture only. Integrated selectors use shared WS1 locations.
// Do not use this list as an authority for live operational-area options.
export const operationalAreas = [
  'Intake', 'Intake Ward A', 'Ward B', 'Ward A & C', 'Theatre 1',
  'General Wards', 'Pharmacy', 'Kennel Block', 'Break Room 2',
  'Outreach', 'Parvo Ward',
] as const;

export const areaFilterOptions = ['All Areas', ...operationalAreas];
