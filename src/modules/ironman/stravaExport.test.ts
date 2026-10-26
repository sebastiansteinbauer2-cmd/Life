import { zipSync, strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { activitiesFromCsv, normalizeType, parseCsv, parseNum, parseStravaDate, readActivitiesCsv } from './stravaExport';

// Zkrácená hlavička podle skutečného exportu (sloupce Distance a Elapsed Time jsou dvakrát)
const HEADER = 'Activity ID,Activity Date,Activity Name,Activity Type,Activity Description,Elapsed Time,Distance,Max Heart Rate,Relative Effort,Commute,Activity Private Note,Activity Gear,Filename,Athlete Weight,Bike Weight,Elapsed Time,Moving Time,Distance,Max Speed,Average Speed,Elevation Gain,Elevation Loss,Average Heart Rate';
const CSV = [
  HEADER,
  '12345678901,"Oct 20, 2026, 5:15:32 AM",Ranní běh,Run,"Klidný, pomalý",3100,10.02,172,45,false,,,activities/1.fit.gz,,,3100,3000,10020.0,4.1,3.34,85,80,151',
  '12345678902,"Oct 21, 2026, 6:00:00 PM",Bazén,Swim,,2700,"1,900",,,false,,,,,,2700,2400,1900.0,,,0,0,',
  '12345678903,"Oct 22, 2026, 7:30:00 AM","Dlouhá ""jízda""",Virtual Ride,,10800,90.5,,,false,,,,,,10800,10500,90500.0,,,400,400,140',
].join('\n');

describe('import exportu ze Stravy', () => {
  it('CSV s uvozovkami a čárkami', () => {
    expect(parseCsv('a,"b,c","d ""e"""\n1,2,3\n')).toEqual([['a', 'b,c', 'd "e"'], ['1', '2', '3']]);
  });

  it('čísla, data a typy', () => {
    expect(parseNum('10.02')).toBe(10.02);
    expect(parseNum('1,900')).toBe(1900);
    expect(parseNum('10,5')).toBe(10.5);
    expect(parseNum('')).toBeNaN();
    expect(new Date(parseStravaDate('Oct 20, 2026, 5:15:32 AM')).toISOString()).toBe('2026-10-20T05:15:32.000Z');
    expect(new Date(parseStravaDate('20. 10. 2026 5:15:32')).toISOString()).toBe('2026-10-20T05:15:32.000Z');
    expect(new Date(parseStravaDate('2026-10-20 05:15:32')).toISOString()).toBe('2026-10-20T05:15:32.000Z');
    expect(normalizeType('Virtual Ride')).toBe('VirtualRide');
    expect(normalizeType('Weight Training')).toBe('WeightTraining');
    expect(normalizeType('Plavání')).toBe('Swim');
    expect(normalizeType('E-Bike Ride')).toBe('EBikeRide');
  });

  it('převede řádky na aktivity se správnými jednotkami', () => {
    const { activities, skipped } = activitiesFromCsv(CSV);
    expect(skipped).toBe(0);
    expect(activities.map((a) => [a.id, a.sport, a.distance, a.movingTime])).toEqual([
      ['12345678901', 'Run', 10020, 3000],
      ['12345678902', 'Swim', 1900, 2400],
      ['12345678903', 'VirtualRide', 90500, 10500],
    ]);
    expect(activities[0].avgHr).toBe(151);
    expect(activities[2].name).toBe('Dlouhá "jízda"');
  });

  it('bez druhého sloupce Distance odhadne jednotky', () => {
    const csv = 'Activity ID,Activity Date,Activity Name,Activity Type,Activity Description,Elapsed Time,Distance\n1,"Oct 20, 2026, 5:15:32 AM",Běh,Run,,1800,5.0\n2,"Oct 20, 2026, 6:15:32 AM",Plav,Swim,,1800,1500';
    const { activities } = activitiesFromCsv(csv);
    expect(activities.map((a) => a.distance)).toEqual([5000, 1500]);
    expect(activities[0].movingTime).toBe(1800);
  });

  it('odmítne cizí soubor', () => {
    expect(() => activitiesFromCsv('jméno,příjmení\nJan,Novák')).toThrow();
  });

  it('vytáhne activities.csv ze ZIPu', async () => {
    const zip = zipSync({ 'export_123/activities.csv': strToU8(CSV), 'export_123/activities/1.fit.gz': new Uint8Array(50_000) });
    const file = new File([zip], 'export.zip', { type: 'application/zip' });
    const text = await readActivitiesCsv(file);
    expect(activitiesFromCsv(text).activities).toHaveLength(3);
  });
});
