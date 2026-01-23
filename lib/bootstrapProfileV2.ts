import { loadProfileV2 } from "@/lib/profileApiV2";
import { mapV2ToFormState } from "@/lib/mapping/mapV2ToFormState";
import { getPositions } from "@/lib/api/positionsApi";
import { makeEmptyProfileV2 } from "@/lib/profile/makeEmptyProfileV2";
import type { ProfileV2 } from "@/lib/types/v2";

type SetState<T> = (v: T) => void;

export async function bootstrapProfileV2(opts: {
  setProfileV2: SetState<ProfileV2>;
  setForm: SetState<any>;
  setLoading?: SetState<boolean>;
}) {
  const { setProfileV2, setForm, setLoading } = opts;

  try {

    const r = await loadProfileV2();
    const p = r.ok ? (r.profile ?? makeEmptyProfileV2()) : makeEmptyProfileV2();
    const positionDtos = await getPositions(); // PositionDTO[]
    const mapped = mapV2ToFormState(p, positionDtos);

    setForm(mapped);
    setProfileV2(p);

  } catch (e) {
    console.error("bootstrapProfileV2 failed", e);
    const p = makeEmptyProfileV2();
    const mapped = mapV2ToFormState(p, []);
    setForm(mapped);
    setProfileV2(p);

  } finally {
    setLoading?.(false);
  }
}
