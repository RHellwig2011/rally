/**
 * @jest-environment node
 */
// Real-world Hudl/TeamSnap xlsx export shapes: clean export, merged title
// banner above the header row, and an empty "Sheet1" before the data tab.
// Workbooks are generated in-memory with exceljs — the same library the
// parser uses to read them.
import ExcelJS from "exceljs";
import { parseRosterXlsx } from "@/lib/utils/roster-file";
import { autoDetectMapping, validateMapping } from "@/lib/utils/roster-mapping";

const HEADERS = [
  "First Name",
  "Last Name",
  "Email",
  "Graduation Year",
  "Jersey",
  "Position",
  "Cell",
];
const PLAYER = ["Marcus", "Webb", "marcus@example.com", 2026, 23, "Guard", "555-0101"];

async function toBuffer(wb: InstanceType<typeof ExcelJS.Workbook>): Promise<Buffer> {
  return Buffer.from(await wb.xlsx.writeBuffer());
}

async function expectParsesClean(buffer: Buffer, expectedRows: number) {
  const parsed = await parseRosterXlsx(buffer, "test.xlsx");
  expect(parsed.headers).toEqual(HEADERS);
  expect(parsed.rows).toHaveLength(expectedRows);
  const validation = validateMapping(autoDetectMapping(parsed.headers));
  expect(validation.valid).toBe(true);
  expect(parsed.rows[0]["First Name"]).toBe("Marcus");
}

describe("parseRosterXlsx real-world export shapes", () => {
  it("parses a clean Hudl-style export", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Athletes");
    ws.addRow(HEADERS);
    ws.addRow(PLAYER);
    ws.addRow(["Tyler", "Brooks", "tyler@example.com", 2027, 4, "Forward", "555-0102"]);
    await expectParsesClean(await toBuffer(wb), 2);
  });

  it("skips a merged title banner above the header row", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Roster");
    ws.mergeCells("A1:G1");
    ws.getCell("A1").value = "Lincoln High School — Varsity Basketball Athletes";
    ws.addRow(HEADERS);
    ws.addRow(PLAYER);
    await expectParsesClean(await toBuffer(wb), 1);
  });

  it("reads past an empty first worksheet to the data tab", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Sheet1"); // empty — the Excel default tab
    const ws = wb.addWorksheet("Athletes");
    ws.addRow(HEADERS);
    ws.addRow(PLAYER);
    await expectParsesClean(await toBuffer(wb), 1);
  });

  it("does not mistake a two-value first row for a title", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Roster");
    // A legitimate 2-column roster: first row IS the header.
    ws.addRow(["Name", "Email"]);
    ws.addRow(["Marcus Webb", "marcus@example.com"]);
    const parsed = await parseRosterXlsx(await toBuffer(wb), "test.xlsx");
    expect(parsed.headers).toEqual(["Name", "Email"]);
    expect(parsed.rows).toHaveLength(1);
  });
});
