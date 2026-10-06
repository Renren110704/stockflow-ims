import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';

// Switches a list page between its normal ("active") view and the
// "archived" view where items can be restored or permanently deleted.
//   <ArchiveViewToggle value="active" onChange={(next) => ...} />   // next: 'active' | 'archived'
export default function ArchiveViewToggle({ value, onChange }) {
  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      color="primary"
      value={value}
      onChange={(e, next) => {
        if (next) onChange(next); // ignore clicks on the already-selected button
      }}
      aria-label="Show active or archived items"
    >
      <ToggleButton value="active" sx={{ px: 2, textTransform: 'none' }}>
        Active
      </ToggleButton>
      <ToggleButton value="archived" sx={{ px: 2, textTransform: 'none', gap: 0.75 }}>
        <ArchiveOutlinedIcon sx={{ fontSize: 16 }} />
        Archived
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
