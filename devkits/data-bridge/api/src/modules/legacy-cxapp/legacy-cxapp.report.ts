import type { LegacyMapping, LegacyPrepared } from "./legacy-cxapp.types.js";

export function legacyPreparationReport(rows: LegacyPrepared[], mappings: LegacyMapping[]) {
  const tables = mappings.map((mapping) => {
    const selected = rows.filter(
      (r) => r.sourceTable === mapping.sourceTable && r.targetTable === mapping.targetTable
    );
    return {
      ...mapping,
      rows: selected.length,
      prepared: selected.filter((r) => !r.issues.length).length,
      blocked: selected.filter((r) => r.issues.length).length
    };
  });
  const invoices = rows.filter((r) => r.targetTable === "billing_sales");
  const items = rows.filter((r) => r.targetTable === "billing_sales_items");
  return {
    tables,
    tableCsv: legacyCsv(
      [
        "Stage",
        "Source",
        "Source key",
        "Destination",
        "Rows",
        "Prepared",
        "Blocked",
        "Field mappings"
      ],
      tables.map((t) => [
        t.phase,
        t.sourceTable,
        t.sourceKey,
        t.targetTable,
        t.rows,
        t.prepared,
        t.blocked,
        JSON.stringify(t.columns)
      ])
    ),
    invoiceCsv: legacyCsv(
      [
        "Source invoice ID",
        "Invoice no",
        "Date",
        "Company key",
        "Party key",
        "Items",
        "Subtotal",
        "GST",
        "Amount",
        "State",
        "Issues",
        "Prepared values"
      ],
      invoices.map((r) => [
        r.sourceKey,
        r.data.invoice_number,
        r.data.issued_on,
        r.source.COMPANY_ID,
        r.source.PARTY_ID,
        items.filter((i) => String(i.source.INVOICE_ID) === r.sourceKey).length,
        r.data.subtotal,
        r.data.tax_amount,
        r.data.amount,
        r.issues.length ? "blocked" : "prepared",
        r.issues.join(" | "),
        JSON.stringify(r.data)
      ])
    ),
    itemCsv: legacyCsv(
      [
        "Source item ID",
        "Source invoice ID",
        "Line",
        "Product key",
        "Quantity",
        "Rate",
        "Taxable",
        "Tax",
        "Total",
        "State",
        "Issues",
        "Prepared values"
      ],
      items.map((r) => [
        r.sourceKey,
        r.source.INVOICE_ID,
        r.data.line_number,
        r.source.PRODUCT_ID,
        r.data.quantity,
        r.data.rate,
        r.data.taxable_amount,
        r.data.tax_amount,
        r.data.line_total,
        r.issues.length ? "blocked" : "prepared",
        r.issues.join(" | "),
        JSON.stringify(r.data)
      ])
    ),
    html: htmlReport(rows, tables)
  };
}

export function legacyCsv(headers: string[], rows: unknown[][]) {
  const cell = (value: unknown) => {
    let text = String(value ?? "");
    if (/^[=+@]|^-(?!\d)/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
}

function htmlReport(
  rows: LegacyPrepared[],
  tables: Array<LegacyMapping & { rows: number; prepared: number; blocked: number }>
): string {
  const json = JSON.stringify({ rows, tables }).replaceAll("<", "\\u003c");
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Legacy invoice preparation</title>
<style>body{font:14px system-ui;margin:28px;color:#182230}button,input,select{padding:9px;margin:5px}button[aria-pressed=true]{background:#182230;color:white}table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;vertical-align:top;border-bottom:1px solid #ccd2da;padding:9px}th{background:#eef1f4}pre{white-space:pre-wrap;max-width:900px}.blocked{color:#9c3d10}.toolbar{display:flex;gap:8px;flex-wrap:wrap}#summary{margin:16px 0}</style>
<h1>Legacy invoice preparation</h1><p>Local review only. Business import is disabled. Blocked rows retain source data and proposed mappings.</p>
<div id="tabs" class="toolbar"></div><div class="toolbar"><select id="table"><option value="">All tables</option></select><input id="search" placeholder="Find source key, value or issue"><label><input id="blocked" type="checkbox">Blocked only</label></div>
<div id="summary"></div><table><thead><tr><th>Source</th><th>Destination</th><th>State</th><th>References and issues</th><th>Data</th></tr></thead><tbody id="rows"></tbody></table>
<div class="toolbar"><button id="previous">Previous</button><span id="page"></span><button id="next">Next</button></div>
<script type="application/json" id="data">${json}</script><script>
const data=JSON.parse(document.getElementById('data').textContent);let phase='core',page=0;const size=100;
const el=id=>document.getElementById(id);const text=(tag,value)=>{const e=document.createElement(tag);e.textContent=value;return e};
for(const [key,label]of [['core','1. Core'],['masters','2. Core Masters'],['billing','3. Billing']]){const b=text('button',label);b.dataset.phase=key;b.onclick=()=>{phase=key;page=0;options();render()};el('tabs').append(b)}
function options(){el('table').replaceChildren(new Option('All tables',''));for(const table of [...new Set(data.rows.filter(r=>r.phase===phase).map(r=>r.targetTable))])el('table').add(new Option(table,table))}
function render(){const list=data.rows.filter(r=>r.phase===phase&&(!el('table').value||r.targetTable===el('table').value)&&(!el('blocked').checked||r.issues.length)&&JSON.stringify(r).toLowerCase().includes(el('search').value.toLowerCase()));page=Math.max(0,Math.min(page,Math.max(0,Math.ceil(list.length/size)-1)));el('rows').replaceChildren();for(const r of list.slice(page*size,(page+1)*size)){const tr=document.createElement('tr');tr.append(text('td',r.sourceTable+' #'+r.sourceKey),text('td',r.targetTable));const status=text('td',r.issues.length?'Blocked':'Prepared');if(r.issues.length)status.className='blocked';tr.append(status,text('td',r.issues.join(' | ')||'References verified for preparation'));const cell=document.createElement('td'),details=document.createElement('details');details.append(text('summary','Source and prepared values'),text('pre',JSON.stringify({source:r.source,prepared:r.data,stageId:r.stageId,existingTargetId:r.targetId},null,2)));cell.append(details);tr.append(cell);el('rows').append(tr)}el('summary').textContent=list.length+' rows • '+list.filter(r=>!r.issues.length).length+' prepared • '+list.filter(r=>r.issues.length).length+' blocked';el('page').textContent=(list.length?page+1:0)+' / '+Math.ceil(list.length/size);el('previous').disabled=page===0;el('next').disabled=(page+1)*size>=list.length;for(const b of el('tabs').children)b.setAttribute('aria-pressed',String(b.dataset.phase===phase))}
for(const id of ['table','search','blocked'])el(id).oninput=()=>{page=0;render()};el('previous').onclick=()=>{page--;render()};el('next').onclick=()=>{page++;render()};options();render();
</script></html>`;
}
