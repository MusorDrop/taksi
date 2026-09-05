import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';

interface PrivacyProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Компонент модального окна "Политика конфиденциальности"
 */
export default function Privacy({ open, onClose }: PrivacyProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Политика конфиденциальности</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            1. Обрабатываемые данные
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Мы обрабатываем минимально необходимый объем информации: имя пользователя, логин, контактный номер
            телефона, логин Telegram и точки маршрута создаваемых поездок.
          </Typography>

          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            2. Цель обработки данных
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Все данные используются исключительно для матчинга попутчиков и координации совместных поездок внутри
            кампуса УрФУ.
          </Typography>

          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            3. Защита и нераспространение
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Данные не передаются рекламным сетям, коммерческим организациям или третьим лицам. Пароли хранятся
            исключительно в виде криптографических хешей, а авторизация защищена JWT-токенами.
          </Typography>

          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            4. Удаление профиля
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Пользователь может в любой момент запросить удаление своего аккаунта и связанных поездок из базы данных.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained" color="primary">
          Закрыть
        </Button>
      </DialogActions>
    </Dialog>
  );
}
