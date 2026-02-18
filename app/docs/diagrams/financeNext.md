← [Architecture Overview](ARCHITECTURE_C4.md)

# Finance Workflow — Next (best Effort)

**Scope:** Finance Workflow (`/finance`)  
**Purpose:** Initialer Ablauf bis UI bereit für Eingaben  
**Related:** [Init](financeINit.md) · [Save](financeSave.md)

---
## Finance Workflow Sequence of Next

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant P as Finance Page
  participant V as validateStep
  participant OUT as mapFormStateToProfileV2
  participant API as profileApiV2

  Note over U,P: handleNext() (best-effort save, then advance step)
  U->>P: click Next
  P->>P: clear saveError
  P->>V: validateStep(currentStep, form)

  alt invalid
    V-->>P: false
    Note over P: stop (no save, no navigation)
  else valid
    V-->>P: true

    alt profileV2 missing
      P->>P: setSaveError("Profil noch nicht geladen.")
      Note over P: best-effort failed, but still advance step
      P->>P: setCurrentStep(currentStep + 1)
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
        Note over P: best-effort failed, but still advance step
      end

      P->>P: setCurrentStep(currentStep + 1)
    end
  end
```
---

⬅️ [Back to Architecture Overview](ARCHITECTURE_C4.md)

**See also**
- [Finance — Init](financeInit.md)
- [Finance — Save](financeSave.md)
- [Finance — Next (best-effort)](financeNext.md)
