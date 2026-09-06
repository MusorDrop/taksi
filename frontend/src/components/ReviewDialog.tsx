import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Rating from '@mui/material/Rating';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import { api } from '../api';

interface ReviewDialogProps {
  open: boolean;
  onClose: () => void;
  rideId: string;
  driverId: string;
  driverName: string;
  onSuccess?: () => void;
}

export default function ReviewDialog({
  open,
  onClose,
  rideId,
  driverId,
  driverName,
  onSuccess,
}: ReviewDialogProps) {
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (): Promise<void> => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    try {
      await api.post('/api/reviews', {
        ride_id: rideId,
        reviewee_id: driverId,
        rating,
        comment: comment.trim() || undefined,
      });
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Не удалось отправить отзыв';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => !isSubmitting && onClose()}
      onClick={(e) => e.stopPropagation()}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle component="div" sx={{ fontWeight: 600 }}>
        <Typography variant="h6" component="span" sx={{ fontWeight: 600 }}>
          Оценить поездку
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Водитель: <strong>{driverName}</strong>
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2">Ваша оценка:</Typography>
            <Rating
              value={rating}
              onChange={(_, val) => setRating(val || 5)}
              max={5}
            />
          </Box>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Отзыв (необязательно)"
            placeholder="Как прошла поездка? Пунктуальность, аккуратность вождения..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={isSubmitting} color="inherit">
          Отмена
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={isSubmitting}
          startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {isSubmitting ? 'Отправка...' : 'Отправить отзыв'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
