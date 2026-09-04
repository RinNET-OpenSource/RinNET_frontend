import type { OngekiCardItemProps } from './OngekiCardItem';
import { OngekiCardItem } from './OngekiCardItem';
import {
  OngekiInteractiveCard,
  type OngekiInteractiveCardProps,
} from './OngekiInteractiveCard';

/**
 * Shared card surface used by the deck/skin editor, picker and full gallery.
 * Keeping the interaction shell and card renderer together prevents those
 * views from drifting into separate (and visually different) card versions.
 */
export type OngekiCardSurfaceProps = OngekiCardItemProps &
  Omit<OngekiInteractiveCardProps, 'children'>;

export function OngekiCardSurface({
  item,
  showHolo,
  showElements,
  holoSheetStyle1,
  holoSheetStyle2,
  ...interactiveProps
}: OngekiCardSurfaceProps) {
  return (
    <OngekiInteractiveCard {...interactiveProps}>
      <OngekiCardItem
        item={item}
        showHolo={showHolo}
        showElements={showElements}
        holoSheetStyle1={holoSheetStyle1}
        holoSheetStyle2={holoSheetStyle2}
      />
    </OngekiInteractiveCard>
  );
}
