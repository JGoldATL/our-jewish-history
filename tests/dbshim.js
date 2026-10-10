// D1-shaped wrapper around node:sqlite for tests: prepare(sql).bind(...).first()/all()/run(), batch([...]) (atomic), meta.last_row_id.
const {DatabaseSync}=require('node:sqlite');
function make(raw){
  const stmt=(sql,args)=>({
    sql,args,
    bind:(...a)=>stmt(sql,a),
    first:async()=>raw.prepare(sql).get(...args)||null,
    all:async()=>({results:raw.prepare(sql).all(...args)}),
    run:async()=>{const r=raw.prepare(sql).run(...args);return {success:true,meta:{last_row_id:Number(r.lastInsertRowid),changes:Number(r.changes)}};},
  });
  return {prepare:sql=>stmt(sql,[]),
    batch:async list=>{raw.exec('BEGIN');try{const out=[];for(const s of list)out.push(await s.run());raw.exec('COMMIT');return out;}catch(e){raw.exec('ROLLBACK');throw e;}}};
}
module.exports={make,DatabaseSync};
