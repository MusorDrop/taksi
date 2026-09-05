import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';

interface TermsProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Компонент модального окна "Пользовательское соглашение"
 */
export default function Terms({ open, onClose }: TermsProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Пользовательское соглашение</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            1. Статус сервиса
          </Typography>
          <Typography variant="body2" color="text.secondary">
            CampusRide — это студенческий сервис совместных поездок для студентов и сотрудников кампуса УрФУ.
            Сервис не является службой такси или коммерческим перевозчиком.
          </Typography>

          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            2. Ответственность сторон
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Сервис носит информационный характер и не несет ответственности за возможные срывы, опоздания, отмены
            поездок или поведение водителей и пассажиров. Участники поездки договариваются самостоятельно.
          </Typography>

          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            3. Имитация оплаты (тестовый режим)
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Все расчеты, цены и переводы в сервисе носят демонстрационный характер. Оплата полностью имитируется,
            реальные финансовые операции и списания средств не осуществляются.
          </Typography>

          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            4. Безопасность и правила кампуса
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Пользователи обязуются соблюдать правила кампуса УрФУ, взаимную вежливость и правила дорожного движения.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained" color="primary">
          Понятно
        </Button>
      </DialogActions>
    </Dialog>
  );
}
