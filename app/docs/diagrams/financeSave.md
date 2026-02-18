← [Architecture Overview](ARCHITECTURE_C4.md)

# Finance Workflow — Save

**Scope:** Finance Workflow (`/finance`)  
**Purpose:** Ablauf ab Save  
**Related:** [Init](financeInit.md) · [Next (best-effort)](financeNext.md)

---
## Finance Workflow Sequence of Save

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant P as Finance Page
  participant V as validateStep
  participant OUT as mapFormStateToProfileV2
  participant API as profileApiV2

  Note over U,P: Save flow (handleSave -> buildAndSaveV2)
  U->>P: click Save
  P->>V: validateStep(currentStep, form)

  alt invalid
    V-->>P: false
    P->>P: setSaveError("Bitte Schritt zuerst vollständig ausfüllen.")
  else valid
    V-->>P: true

    alt profileV2 missing
      P->>P: setSaveError("Profil noch nicht geladen.")
    else profileV2 present
      P->>OUT: mapFormStateToProfileV2(form, profileV2)
      OUT-->>P: next ProfileV2
      P->>P: setProfileV2(next) (local)

      P->>API: saveProfileV2(next)

      alt save ok
        API-->>P: { ok:true, profile? }
        P->>P: setCompleted[currentStep] = true
        P->>P: clear saveError
        P->>P: setProfileV2(serverProfile or next)
      else save failed
        API-->>P: { ok:false, status }
        P->>P: setSaveError(status-specific)
      end
    end
  end
```
---

⬅️ [Back to Architecture Overview](ARCHITECTURE_C4.md)

**See also**
- [Finance — Init](financeInit.md)
- [Finance — Save](financeSave.md)
- [Finance — Next (best-effort)](financeNext.md)