← [Architecture Overview](ARCHITECTURE_C4.md)

# Finance Workflow — Init (UI ready)

**Scope:** Finance Workflow (`/finance`)  
**Purpose:** Initialer Ablauf bis UI bereit für Eingaben  
**Related:** [Save](financeSave.md) · [Next (best-effort)](financeNext.md)

---
## Finance Workflow Sequence of Init

```mermaid
sequenceDiagram
  autonumber
  participant P as Finance Page
  participant API as profileApiV2
  participant IN as mapV2ToFormState
  participant EMPTY as makeEmptyProfileV2

  Note over P: Mount (useEffect) -> UI ready
  P->>API: loadProfileV2()

  alt ok and profile present
    API-->>P: { ok:true, profile }
    P->>IN: mapV2ToFormState(profile)
    IN-->>P: form
    P->>P: setProfileV2(profile)
    P->>P: setForm(form)
  else not ok or profile missing
    API-->>P: { ok:false } or { ok:true, profile:null }
    P->>EMPTY: makeEmptyProfileV2()
    EMPTY-->>P: emptyProfile
    P->>IN: mapV2ToFormState(emptyProfile)
    IN-->>P: form
    P->>P: setProfileV2(emptyProfile)
    P->>P: setForm(form)
  end
```
---

⬅️ [Back to Architecture Overview](ARCHITECTURE_C4.md)

**See also**
- [Finance — Init](financeInit.md)
- [Finance — Save](financeSave.md)
- [Finance — Next (best-effort)](financeNext.md)