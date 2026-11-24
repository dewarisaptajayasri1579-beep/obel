# Changelog

## v1.1 — Data Consistency & Correction Architecture

Pembaruan utama:
- menjadikan konsistensi data sebagai requirement P0;
- universal no-hard-delete untuk posted transactions;
- cancel dengan reversal;
- revision dengan reverse + replacement;
- impact preview sebelum correction;
- post-close correction dan automatic restatement;
- stock opname Gudang/Booth;
- recount untuk physical count yang salah;
- adjustment reversal;
- payment correction;
- reconciliation engine dan reconciliation cases;
- transaction lineage/version metadata;
- correction API/RPC contract;
- acceptance tests tambahan AC-26 s.d. AC-40;
- transaction impact matrix;
- membedakan VOID dengan real customer REFUND/RETURN.
