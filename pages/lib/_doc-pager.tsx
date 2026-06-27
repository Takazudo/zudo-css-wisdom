/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host thin-stub — see @takazudo/zudo-doc/doc-pager (epic #2344, S7).
import { t } from "@/config/i18n";
import { createDocPager } from "@takazudo/zudo-doc/doc-pager";

export type { DocPagerProps } from "@takazudo/zudo-doc/doc-pager";

export const DocPager = createDocPager({ t });
