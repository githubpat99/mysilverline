// ==================================
// app/lotto/page.tsx
// Uses summary-like tile styling
// Uses PercentInput from ./components/PercentInput
// ==================================

"use client";

import Link from "next/link";
import { useMemo, useEffect, useState } from "react";
import type { Model1DraftState } from "@/lib/lotto/types";
import {
  addChild,
  createEmptyDraft,
  draftToModel1Input,
  newId,
  removeChild,
  todayBaseYear,
} from "@/lib/lotto/modelCFBW_HH.types";
import PercentInput from "./components/PercentInput";
import RemoveButton from "./components/RemoveButton";
import MoneyInput from "@/app/lotto/components/MoneyInput";
import { loadLottoDraft, saveLottoDraft } from "@/lib/lotto/persist";

export default function LottoPage() {

  // Hooks & State
  const [draft, setDraft] = useState<Model1DraftState>(() => createEmptyDraft());
  const [mounted, setMounted] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const baseYear = useMemo(() => todayBaseYear(), []);
  const mapped = useMemo(() => draftToModel1Input(draft, baseYear), [draft, baseYear]);
  const issues = mapped.ok ? mapped.issues : mapped.issues;

  // 1) nach Mount Draft aus sessionStorage holen
  useEffect(() => {
    setDraft(loadLottoDraft() ?? createEmptyDraft());
    setMounted(true);
  }, []);

  // 2) erst speichern, wenn gemountet (sonst überschreibst du evtl. sofort)
  useEffect(() => {
    if (!mounted) return;
    saveLottoDraft(draft);
  }, [draft, mounted]);

  if (!mounted) {
    return (
      <div className="p-4 sm:p-6 text-sm text-slate-400">
        Lädt…
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-sky-400 mb-10">Lotto / Nie-wieder-arbeiten</h1>

        <Link
          href="/forecast?src=lotto"
          className="inline-flex items-center rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 hover:text-sky-400"
        >
          Forecast mit Lotto-Szenario
        </Link>


        {/* Validation */}
        {issues.length > 0 && (
          <div className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-amber-300">Eingaben unvollständig</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-200">
              {issues.map((i) => (
                <li key={`${i.path}:${i.message}`}>
                  <span className="font-mono text-slate-300">{i.path}</span>: {i.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-10 lg:grid-cols-2">
          {/* Haushalt */}
          <Tile title="Haushalt" subtitle="Partner und Kinder (dynamische Liste)">
            <Section title="Du">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Name/Label"
                  value={draft.household.self.label}
                  onChange={(v) =>
                    setDraft((d) => ({
                      ...d,
                      household: { ...d.household, self: { ...d.household.self, label: v } },
                    }))
                  }
                />
                <NumberInput
                  label="Geburtsjahr"
                  value={draft.household.self.birthYear}
                  onChange={(n) =>
                    setDraft((d) => ({
                      ...d,
                      household: { ...d.household, self: { ...d.household.self, birthYear: n } },
                    }))
                  }
                  size="short"
                />
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <NumberInput
                  label="Plan bis Alter"
                  value={draft.household.self.planToAge}
                  onChange={(n) =>
                    setDraft((d) => ({
                      ...d,
                      household: { ...d.household, self: { ...d.household.self, planToAge: n } },
                    }))
                  }
                  size="short"
                />
                <NumberInput
                  label="Sicherheitsjahre"
                  value={draft.household.self.extraSafetyYears}
                  onChange={(n) =>
                    setDraft((d) => ({
                      ...d,
                      household: {
                        ...d.household,
                        self: { ...d.household.self, extraSafetyYears: n },
                      },
                    }))
                  }
                  size="short"
                />
                <Toggle
                  label="Sofort aufhören?"
                  checked={draft.household.self.retireNow}
                  onChange={(checked) =>
                    setDraft((d) => ({
                      ...d,
                      household: { ...d.household, self: { ...d.household.self, retireNow: checked } },
                    }))
                  }
                />
              </div>

              {!draft.household.self.retireNow && (
                <div className="mt-4">
                  <NumberInput
                    label="Aufhören mit Alter"
                    value={draft.household.self.retireAtAge ?? 65}
                    onChange={(n) =>
                      setDraft((d) => ({
                        ...d,
                        household: {
                          ...d.household,
                          self: { ...d.household.self, retireAtAge: n },
                        },
                      }))
                    }
                    size="short"
                  />
                </div>
              )}
            </Section>

            <Section title="Partner:in">
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm text-slate-300">Partner:in hinzufügen</div>
                <Toggle
                  label=""
                  checked={draft.household.partner.enabled}
                  onChange={(checked) =>
                    setDraft((d) => ({
                      ...d,
                      household: { ...d.household, partner: { ...d.household.partner, enabled: checked } },
                    }))
                  }
                />
              </div>

              {draft.household.partner.enabled && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Name/Label"
                    value={draft.household.partner.label}
                    onChange={(v) =>
                      setDraft((d) => ({
                        ...d,
                        household: { ...d.household, partner: { ...d.household.partner, label: v } },
                      }))
                    }
                  />
                  <NumberInput
                    label="Geburtsjahr"
                    value={draft.household.partner.birthYear ?? 0}
                    onChange={(n) =>
                      setDraft((d) => ({
                        ...d,
                        household: {
                          ...d.household,
                          partner: { ...d.household.partner, birthYear: n || undefined },
                        },
                      }))
                    }
                    size="short"
                  />

                  <Input
                    label="Geburtsdatum (optional, YYYY-MM-DD)"
                    placeholder="1982-10-27"
                    value={draft.household.partner.birthDate ?? ""}
                    onChange={(v) =>
                      setDraft((d) => ({
                        ...d,
                        household: {
                          ...d.household,
                          partner: { ...d.household.partner, birthDate: v ? (v as any) : undefined },
                        },
                      }))
                    }
                  />

                  <NumberInput
                    label="Aufhören mit Alter (optional)"
                    value={draft.household.partner.retireAtAge ?? 0}
                    onChange={(n) =>
                      setDraft((d) => ({
                        ...d,
                        household: {
                          ...d.household,
                          partner: { ...d.household.partner, retireAtAge: n || undefined },
                        },
                      }))
                    }
                    size="short"
                  />
                </div>
              )}
            </Section>

            <Section title="Kinder">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-slate-300">Geburtsdatum ist Pflicht (für spätere Steuern).</p>
                <button
                  className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm hover:bg-slate-950/60"
                  type="button"
                  onClick={() => setDraft((d) => addChild(d))}
                >
                  + Kind hinzufügen
                </button>
              </div>

              {draft.household.children.length === 0 ? (
                <div className="mt-3 text-sm text-slate-400">Keine Kinder erfasst.</div>
              ) : (
                <div className="mt-4 grid gap-4">
                  {draft.household.children.map((c, idx) => (
                    <div key={c.id} className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
                      <div className="mb-3 flex items-center justify-between gap-4">
                        <div className="font-semibold text-slate-200">Kind {idx + 1}</div>
                        <button
                          className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm hover:bg-slate-950/60"
                          type="button"
                          onClick={() => setDraft((d) => removeChild(d, c.id))}
                        >
                          Entfernen
                        </button>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <Input
                          label="Name/Label"
                          value={c.label}
                          onChange={(v) =>
                            setDraft((d) => ({
                              ...d,
                              household: {
                                ...d.household,
                                children: d.household.children.map((x) => (x.id === c.id ? { ...x, label: v } : x)),
                              },
                            }))
                          }
                        />
                        <Input
                          label="Geburtsdatum (YYYY-MM-DD)"
                          placeholder="2013-05-12"
                          value={c.birthDate}
                          onChange={(v) =>
                            setDraft((d) => ({
                              ...d,
                              household: {
                                ...d.household,
                                children: d.household.children.map((x) =>
                                  x.id === c.id ? { ...x, birthDate: v as any } : x
                                ),
                              },
                            }))
                          }
                        />
                      </div>

                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <Toggle
                          label="Im Haushalt"
                          checked={c.inHousehold}
                          onChange={(checked) =>
                            setDraft((d) => ({
                              ...d,
                              household: {
                                ...d.household,
                                children: d.household.children.map((x) =>
                                  x.id === c.id ? { ...x, inHousehold: checked } : x
                                ),
                              },
                            }))
                          }
                        />
                        <Toggle
                          label="Abhängig"
                          checked={c.dependent}
                          onChange={(checked) =>
                            setDraft((d) => ({
                              ...d,
                              household: {
                                ...d.household,
                                children: d.household.children.map((x) =>
                                  x.id === c.id ? { ...x, dependent: checked } : x
                                ),
                              },
                            }))
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </Tile>

          {/* Ausgaben */}
          <Tile title="Ausgaben" subtitle="Heute + Einmalereignisse">
            <Section title="Basis">
              <MoneyInput
                label="Jahresausgaben heute (gesamt)"
                value={draft.spending.annualSpendingToday}
                onChange={(n) => setDraft((d) => ({ ...d, spending: { ...d.spending, annualSpendingToday: n } }))}
              />

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Select
                  label="Indexierung"
                  value={draft.spending.indexation}
                  options={[
                    { value: "inflation", label: "mit Inflation" },
                    { value: "fixed_real", label: "real konstant" },
                    { value: "fixed_nominal", label: "nominal konstant" },
                  ]}
                  onChange={(v) => setDraft((d) => ({ ...d, spending: { ...d.spending, indexation: v as any } }))}
                />

                <PercentInput
                  label="Extra-Wachstum p.a. (z. B. KK > Inflation)"
                  value={draft.spending.extraGrowth}
                  onChange={(v) => setDraft((d) => ({ ...d, spending: { ...d.spending, extraGrowth: v } }))}
                />
              </div>
            </Section>

            <Section title="Einmalige Ausgaben">
              <div className="mb-3 flex items-center justify-between gap-4">
                <div className="text-sm text-slate-300">Betrag und “in X Jahren”.</div>
                <button
                  className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm hover:bg-slate-950/60"
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      spending: {
                        ...d.spending,
                        oneOffEvents: [...d.spending.oneOffEvents, { id: newId(), label: "Event", amount: 0, yearOffset: 0 }],
                      },
                    }))
                  }
                >
                  + Event
                </button>
              </div>

              {draft.spending.oneOffEvents.length === 0 ? (
                <div className="text-sm text-slate-400">Keine Events.</div>
              ) : (
                <div className="grid gap-4">
                  {draft.spending.oneOffEvents.map((e) => (
                    <div
                      key={e.id}
                      className="grid gap-4 items-end grid-cols-1 sm:grid-cols-[minmax(6rem,1fr)_7rem_5rem_1fr]"
                    >

                      <TextInput
                        label="Label"
                        value={e.label}
                        size="short"
                        onChange={(v) =>
                          setDraft((d) => ({
                            ...d,
                            spending: {
                              ...d.spending,
                              oneOffEvents: d.spending.oneOffEvents.map((x) => (x.id === e.id ? { ...x, label: v } : x)),
                            },
                          }))
                        }
                      />

                      <MoneyInput
                        label="Betrag"
                        value={e.amount}
                        onChange={(n) =>
                          setDraft((d) => ({
                            ...d,
                            spending: {
                              ...d.spending,
                              oneOffEvents: d.spending.oneOffEvents.map((x) => (x.id === e.id ? { ...x, amount: n } : x)),
                            },
                          }))
                        }
                      />

                      <div className="min-w-0">
                        <NumberInput
                          label="in X Jahren"
                          value={e.yearOffset}
                          onChange={(n) =>
                            setDraft((d) => ({
                              ...d,
                              spending: {
                                ...d.spending,
                                oneOffEvents: d.spending.oneOffEvents.map((x) => (x.id === e.id ? { ...x, yearOffset: n } : x)),
                              },
                            }))
                          }
                        />
                      </div>
                      <div className="flex sm:justify-end">
                        <RemoveButton
                          className="h-10 rounded-xl border border-slate-800 bg-slate-950/40 px-3 text-sm hover:bg-slate-950/60 whitespace-nowrap"
                          onClick={() =>
                            setDraft((d) => ({
                              ...d,
                              spending: { ...d.spending, oneOffEvents: d.spending.oneOffEvents.filter((x) => x.id !== e.id) },
                            }))
                          }
                        >
                        </RemoveButton>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </Tile>

          <Tile title="Einnahmen (Renten)" subtitle="AHV/PK/3a als Renten oder Kapital (heute, Start ab Alter)">
            <Section title="Du">
              <PensionList
                pensions={draft.futureIncome.selfPensions}
                onChange={(next) => setDraft((d) => ({ ...d, futureIncome: { ...d.futureIncome, selfPensions: next } }))}
              />
            </Section>

            {draft.household.partner.enabled && (
              <Section title="Partner:in">
                <PensionList
                  pensions={draft.futureIncome.partnerPensions}
                  onChange={(next) => setDraft((d) => ({ ...d, futureIncome: { ...d.futureIncome, partnerPensions: next } }))}
                />
              </Section>
            )}
          </Tile>

          <Tile title="Ausgaben-Phasen" subtitle="Änderungen ab einem bestimmten Alter (z. B. Kinder draussen, Reisen weniger)">
            <Section title="Anpassungen">
              <div className="mb-3 flex items-center justify-between gap-4">
                <div className="text-sm text-slate-300">Alle Beträge in CHF/Jahr (heutige Kaufkraft).</div>
                <button
                  className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm hover:bg-slate-950/60"
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      spending: {
                        ...d.spending,
                        adjustments: [
                          ...d.spending.adjustments,
                          { id: newId(), label: "Kinder draussen", startsAtAge: 45, annualDelta: -12000 },
                        ],
                      },
                    }))
                  }
                >
                  + Phase
                </button>
              </div>

              {draft.spending.adjustments.length === 0 ? (
                <div className="text-sm text-slate-400">Keine Anpassungen.</div>
              ) : (
                <div className="grid gap-4">
                  {draft.spending.adjustments.map((a) => (
                    <div key={a.id}
                      className="grid gap-4 items-end grid-cols-1 sm:grid-cols-[minmax(6rem,max-content)_6rem_7rem_1fr]"
                    >
                      <TextInput
                        label="Label"
                        value={a.label}
                        size="short"
                        onChange={(v) =>
                          setDraft((d) => ({
                            ...d,
                            spending: {
                              ...d.spending,
                              adjustments: d.spending.adjustments.map((x) => (x.id === a.id ? { ...x, label: v } : x)),
                            },
                          }))
                        }
                      />

                      <NumberInput
                        label="ab Alter"
                        value={a.startsAtAge}
                        size="short"
                        onChange={(n) =>
                          setDraft((d) => ({
                            ...d,
                            spending: {
                              ...d.spending,
                              adjustments: d.spending.adjustments.map((x) => (x.id === a.id ? { ...x, startsAtAge: n } : x)),
                            },
                          }))
                        }
                      />

                      <MoneyInput
                        label="Δ CHF/Jahr"
                        value={a.annualDelta}
                        onChange={(n) =>
                          setDraft((d) => ({
                            ...d,
                            spending: {
                              ...d.spending,
                              adjustments: d.spending.adjustments.map((x) => (x.id === a.id ? { ...x, annualDelta: n } : x)),
                            },
                          }))
                        }
                      />
                      <div className="flex sm:justify-end">
                        <RemoveButton
                          onClick={() =>
                            setDraft((d) => ({
                              ...d,
                              spending: { ...d.spending, adjustments: d.spending.adjustments.filter((x) => x.id !== a.id) },
                            }))
                          }
                        >
                        </RemoveButton>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </Tile>

          {/* Vermögen */}
          <Tile title="Vermögen & Schulden" subtitle="Startwerte heute">
            <Section title="Vermögen">
              <div className="grid gap-4 sm:grid-cols-2">
                <MoneyInput label="Liquid" value={draft.wealth.liquid} onChange={(n) => setDraft((d) => ({ ...d, wealth: { ...d.wealth, liquid: n } }))} />
                <MoneyInput label="Investiert" value={draft.wealth.invested} onChange={(n) => setDraft((d) => ({ ...d, wealth: { ...d.wealth, invested: n } }))} />
                <MoneyInput label="Gebunden (PK/3a etc.)" value={draft.wealth.tiedPension} onChange={(n) => setDraft((d) => ({ ...d, wealth: { ...d.wealth, tiedPension: n } }))} />
                <MoneyInput label="Immobilien (Wert)" value={draft.wealth.realEstate} onChange={(n) => setDraft((d) => ({ ...d, wealth: { ...d.wealth, realEstate: n } }))} />
                <MoneyInput label="Notreserve (Cash)" value={draft.wealth.emergencyReserveToday} onChange={(n) => setDraft((d) => ({ ...d, wealth: { ...d.wealth, emergencyReserveToday: n } }))} />
              </div>
            </Section>

            <Section title="Schulden">
              <div className="mb-3 flex items-center justify-between gap-4">
                <div className="text-sm text-slate-300">Hypotheken/Kredite (optional).</div>
                <button
                  className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm hover:bg-slate-950/60"
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      wealth: {
                        ...d.wealth,
                        debts: [
                          ...d.wealth.debts,
                          { id: newId(), label: "Hypothek/Kredit", principalToday: 0, annualInterestRate: 0.02, repayMode: "interest_only", payoffImmediately: false },
                        ],
                      },
                    }))
                  }
                >
                  + Schuld
                </button>
              </div>

              {draft.wealth.debts.length === 0 ? (
                <div className="text-sm text-slate-400">Keine Schulden.</div>
              ) : (
                <div className="grid gap-4">
                  {draft.wealth.debts.map((debt) => (
                    <div key={debt.id} className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Input
                          label="Label"
                          value={debt.label}
                          onChange={(v) =>
                            setDraft((d) => ({
                              ...d,
                              wealth: {
                                ...d.wealth,
                                debts: d.wealth.debts.map((x) => (x.id === debt.id ? { ...x, label: v } : x)),
                              },
                            }))
                          }
                        />
                        <MoneyInput
                          label="Saldo heute"
                          value={debt.principalToday}
                          onChange={(n) =>
                            setDraft((d) => ({
                              ...d,
                              wealth: {
                                ...d.wealth,
                                debts: d.wealth.debts.map((x) => (x.id === debt.id ? { ...x, principalToday: n } : x)),
                              },
                            }))
                          }
                        />

                        <PercentInput
                          label="Zins p.a."
                          value={debt.annualInterestRate}
                          onChange={(v) =>
                            setDraft((d) => ({
                              ...d,
                              wealth: {
                                ...d.wealth,
                                debts: d.wealth.debts.map((x) => (x.id === debt.id ? { ...x, annualInterestRate: v } : x)),
                              },
                            }))
                          }
                        />

                        <Select
                          label="Rückzahlung"
                          value={debt.repayMode}
                          options={[
                            { value: "interest_only", label: "nur Zins" },
                            { value: "amortize_linear", label: "linear" },
                            { value: "amortize_fixed_payment", label: "fixe Jahresrate" },
                          ]}
                          onChange={(v) =>
                            setDraft((d) => ({
                              ...d,
                              wealth: {
                                ...d.wealth,
                                debts: d.wealth.debts.map((x) => (x.id === debt.id ? { ...x, repayMode: v as any } : x)),
                              },
                            }))
                          }
                        />

                        {debt.repayMode === "amortize_linear" && (
                          <NumberInput
                            label="Amortisationsjahre"
                            value={debt.amortizeYears ?? 10}
                            onChange={(n) =>
                              setDraft((d) => ({
                                ...d,
                                wealth: {
                                  ...d.wealth,
                                  debts: d.wealth.debts.map((x) => (x.id === debt.id ? { ...x, amortizeYears: n } : x)),
                                },
                              }))
                            }
                          />
                        )}

                        {debt.repayMode === "amortize_fixed_payment" && (
                          <NumberInput
                            label="Jahresrate"
                            value={debt.annualPayment ?? 0}
                            onChange={(n) =>
                              setDraft((d) => ({
                                ...d,
                                wealth: {
                                  ...d.wealth,
                                  debts: d.wealth.debts.map((x) => (x.id === debt.id ? { ...x, annualPayment: n } : x)),
                                },
                              }))
                            }
                          />
                        )}

                        <div className="sm:col-span-2 grid gap-4 sm:grid-cols-3">
                          <Toggle
                            label="Sofort ablösen (t=0)"
                            checked={!!debt.payoffImmediately}
                            onChange={(checked) =>
                              setDraft((d) => ({
                                ...d,
                                wealth: {
                                  ...d.wealth,
                                  debts: d.wealth.debts.map((x) => (x.id === debt.id ? { ...x, payoffImmediately: checked } : x)),
                                },
                              }))
                            }
                          />
                          <div className="sm:col-span-2 flex items-end">
                            <button
                              className="w-full rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm hover:bg-slate-950/60"
                              type="button"
                              onClick={() =>
                                setDraft((d) => ({
                                  ...d,
                                  wealth: { ...d.wealth, debts: d.wealth.debts.filter((x) => x.id !== debt.id) },
                                }))
                              }
                            >
                              Schuld entfernen
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </Tile>

          {/* Annahmen */}
          <Tile title="Annahmen" subtitle="Rendite, Inflation, Kosten, Steuern">
            <Section title="Basis">
              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  label="Währung"
                  value={draft.assumptions.currency}
                  options={[
                    { value: "CHF", label: "CHF" },
                    { value: "EUR", label: "EUR" },
                    { value: "USD", label: "USD" },
                  ]}
                  onChange={(v) => setDraft((d) => ({ ...d, assumptions: { ...d.assumptions, currency: v as any } }))}
                />

                <Select
                  label="Rendite-Modus"
                  value={draft.assumptions.returnMode}
                  options={[
                    { value: "real", label: "Real (empfohlen)" },
                    { value: "nominal", label: "Nominal + Inflation" },
                  ]}
                  onChange={(v) => setDraft((d) => ({ ...d, assumptions: { ...d.assumptions, returnMode: v as any } }))}
                />
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {draft.assumptions.returnMode === "real" ? (
                  <PercentInput
                    label="Realrendite p.a."
                    value={draft.assumptions.realReturn ?? 0}
                    onChange={(v) => setDraft((d) => ({ ...d, assumptions: { ...d.assumptions, realReturn: v } }))}
                  />
                ) : (
                  <>
                    <PercentInput
                      label="Nominalrendite p.a."
                      value={draft.assumptions.nominalReturn ?? 0}
                      onChange={(v) => setDraft((d) => ({ ...d, assumptions: { ...d.assumptions, nominalReturn: v } }))}
                    />
                    <PercentInput
                      label="Inflation p.a."
                      value={draft.assumptions.inflation ?? 0}
                      onChange={(v) => setDraft((d) => ({ ...d, assumptions: { ...d.assumptions, inflation: v } }))}
                    />
                  </>
                )}

                <PercentInput
                  label="Kosten p.a. (Fees)"
                  value={draft.assumptions.annualFees ?? 0}
                  onChange={(v) => setDraft((d) => ({ ...d, assumptions: { ...d.assumptions, annualFees: v } }))}
                />
              </div>
            </Section>

            <Section title="Steuern (v1)">
              <Select
                label="Modus"
                value={draft.assumptions.taxMode}
                options={[
                  { value: "simple_effective", label: "effektive Sätze" },
                  { value: "none", label: "ignorieren (Test)" },
                ]}
                onChange={(v) => setDraft((d) => ({ ...d, assumptions: { ...d.assumptions, taxMode: v as any } }))}
              />

              {draft.assumptions.taxMode === "simple_effective" && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <PercentInput
                    label="Einkommenssteuer (effektiv)"
                    value={draft.assumptions.effectiveIncomeTaxRate ?? 0}
                    onChange={(v) => setDraft((d) => ({ ...d, assumptions: { ...d.assumptions, effectiveIncomeTaxRate: v } }))}
                  />
                  <PercentInput
                    label="Vermögenssteuer"
                    value={draft.assumptions.wealthTaxRate ?? 0}
                    onChange={(v) => setDraft((d) => ({ ...d, assumptions: { ...d.assumptions, wealthTaxRate: v } }))}
                  />
                </div>
              )}
            </Section>
          </Tile>
        </div>

        {/* Actions */}
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <button
            className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2 text-sm shadow-lg hover:bg-slate-900/80"
            type="button"
            onClick={() => setDraft(createEmptyDraft())}
          >
            Reset Draft
          </button>
          <button
            className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2 text-sm shadow-lg hover:bg-slate-900/80"
            type="button"
            onClick={() => setShowJson((s) => !s)}
          >
            {showJson ? "JSON ausblenden" : "JSON anzeigen"}
          </button>
        </div>

        {showJson && (
          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-slate-200 mb-3">Mapped Model1Input</h2>
            <pre className="overflow-auto rounded-xl bg-black/30 p-4 text-xs">
              {JSON.stringify(mapped.ok ? mapped.value : { error: "invalid", issues: mapped.issues }, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </main>
  );
}

// --- Summary-like Tile/Section ---

function Tile({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-slate-100">{title}</h2>
        {subtitle && <p className="text-sm text-slate-300 mt-1">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm uppercase tracking-wide text-slate-400 mb-3">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  size = "normal", // "short" | "normal"
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  size?: "short" | "normal";
}) {
  const isShort = size === "short";
  const maxLen = isShort ? 15 : undefined;

  return (
    <label className="grid gap-2 min-w-0">
      <span className="text-sm text-slate-300">{label}</span>
      <input
        className="min-w-0 w-full rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-600/40"
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          onChange(isShort ? next.slice(0, 15) : next);
        }}
        placeholder={placeholder}
        maxLength={maxLen}
      />
    </label>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm text-slate-300">{label}</span>
      <input
        className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-600/40"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
function NumberInput({
  label,
  value,
  onChange,
  size = "normal", // "short" | "normal"
  suffix,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  size?: "short" | "normal";
  suffix?: string;
}) {
  const width =
    size === "short"
      ? "w-20 sm:w-20"
      : "w-full min-w-0";

  return (
    <label className="grid gap-2">
      <span className="text-sm text-slate-300">{label}</span>
      <div className={`flex items-center gap-2 ${width}`}>
        <input
          className="w-full rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-right outline-none focus:ring-2 focus:ring-sky-600/40"
          type="number"
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {suffix && (
          <span className="text-sm text-slate-400 whitespace-nowrap">
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm text-slate-300">{label}</span>
      <select
        className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-600/40"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 text-sm text-slate-200">
      <input
        className="h-4 w-4 accent-sky-500"
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-slate-300">{label}</span>
    </label>
  );
}
function PensionList({
  pensions,
  onChange,
}: {
  pensions: any[];
  onChange: (next: any[]) => void;
}) {
  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-slate-300">Rente (CHF/Jahr) oder Kapital (CHF) ab Alter.</div>
        <button
          className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm hover:bg-slate-950/60"
          type="button"
          onClick={() =>
            onChange([
              ...pensions,
              {
                id: newId(),
                label: "AHV",
                mode: "annuity",
                startsAtAge: 65,
                annuityAnnual: 0,
                capitalAmount: undefined,
                taxable: true,
                taxCategory: "pension",
              },
            ])
          }
        >
          + Rente
        </button>
      </div>

      {pensions.length === 0 ? (
        <div className="text-sm text-slate-400">Keine Renten erfasst.</div>
      ) : (
        pensions.map((p: any) => (
          <div key={p.id} className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput
                label="Label"
                value={p.label}
                onChange={(v) => onChange(pensions.map((x: any) => (x.id === p.id ? { ...x, label: v } : x)))}
              />

              <Select
                label="Modus"
                value={p.mode}
                options={[
                  { value: "annuity", label: "Rente (jährlich)" },
                  { value: "capital", label: "Kapital (einmalig)" },
                ]}
                onChange={(v) => {
                  const next = pensions.map((x: any) =>
                    x.id === p.id
                      ? {
                        ...x,
                        mode: v,
                        annuityAnnual: v === "annuity" ? (x.annuityAnnual ?? 0) : undefined,
                        capitalAmount: v === "capital" ? (x.capitalAmount ?? 0) : undefined,
                      }
                      : x
                  );
                  onChange(next);
                }}
              />

              <NumberInput
                label="Start ab Alter"
                value={p.startsAtAge}
                size="short"
                suffix="J"
                onChange={(n) => onChange(pensions.map((x: any) => (x.id === p.id ? { ...x, startsAtAge: n } : x)))}
              />

              {p.mode === "annuity" ? (
                <MoneyInput
                  label="Rente CHF/Jahr"
                  value={p.annuityAnnual ?? 0}
                  onChange={(n) => onChange(pensions.map((x: any) => (x.id === p.id ? { ...x, annuityAnnual: n } : x)))}
                />
              ) : (
                <MoneyInput
                  label="Kapital CHF"
                  value={p.capitalAmount ?? 0}
                  onChange={(n) => onChange(pensions.map((x: any) => (x.id === p.id ? { ...x, capitalAmount: n } : x)))}
                />
              )}

              <Toggle
                label="steuerbar"
                checked={!!p.taxable}
                onChange={(checked) => onChange(pensions.map((x: any) => (x.id === p.id ? { ...x, taxable: checked } : x)))}
              />

              <div className="flex items-end">
                <button
                  className="h-10 w-full rounded-xl border border-slate-800 bg-slate-950/40 px-4 text-sm hover:bg-slate-950/60"
                  type="button"
                  onClick={() => onChange(pensions.filter((x: any) => x.id !== p.id))}
                >
                  Entfernen
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}