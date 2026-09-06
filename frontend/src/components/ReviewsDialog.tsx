import { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Rating from '@mui/material/Rating';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import StarIcon from '@mui/icons-material/Star';
import { api } from '../api';
import type { Review, ReviewsResponse } from '../types';
import { formatAvatarUrl, formatDateString } from '../utils';

export interface ReviewsDialogProps {
  open: boolean;
  onClose: () => void;
  driverId: string;
  driverName: string;
  driverAvatarUrl?: string | null;
  driverRating?: number | null;
  driverReviewsCount?: number;
}

/**
 * Модальное окно просмотра отзывов о водителе
 */
export default function ReviewsDialog({
  open,
  onClose,
  driverId,
  driverName,
  driverAvatarUrl,
  driverRating,
  driverReviewsCount,
}: ReviewsDialogProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !driverId) {
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    async function fetchReviews(): Promise<void> {
      try {
        const query = `/api/reviews?reviewee_id=${encodeURIComponent(driverId)}&user_id=${encodeURIComponent(driverId)}`;
        const res = await api.get<ReviewsResponse>(query, {
          signal: controller.signal,
        });
        if (res?.reviews) {
          setReviews(res.reviews);
        } else {
          setReviews([]);
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : 'Не удалось загрузить отзывы';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    }

    fetchReviews();

    return () => {
      controller.abort();
    };
  }, [open, driverId]);

  const initials = driverName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const ratingVal = Number(driverRating || 0);
  const reviewsCount = Number(driverReviewsCount ?? reviews.length);
  const hasRating = reviewsCount > 0 && ratingVal > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      onClick={(e) => e.stopPropagation()}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ m: 0, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Отзывы о водителе
        </Typography>
        <IconButton size="small" onClick={onClose} aria-label="close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 2.5 }}>
        {/* Шапка с информацией о водителе и общем рейтинге */}
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2.5 }}>
          <Avatar
            src={formatAvatarUrl(driverAvatarUrl)}
            sx={{ bgcolor: 'primary.main', width: 48, height: 48, fontSize: 16 }}
          >
            {initials}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }} noWrap>
              {driverName}
            </Typography>
            {hasRating ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <Rating value={ratingVal} precision={0.1} readOnly size="small" />
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {ratingVal.toFixed(1)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  ({reviewsCount} {reviewsCount === 1 ? 'отзыв' : 'отзывов'})
                </Typography>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Нет отзывов
              </Typography>
            )}
          </Box>
        </Stack>

        <Divider sx={{ mb: 2 }} />

        {/* Содержимое списка отзывов */}
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={32} />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : reviews.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <StarIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              У этого водителя пока нет отзывов.
            </Typography>
          </Box>
        ) : (
          <Stack spacing={1.5}>
            {reviews.map((rev) => (
              <Paper key={rev.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {rev.reviewer_first_name || rev.reviewer_username || 'Пассажир'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDateString(rev.created_at)}
                  </Typography>
                </Stack>
                <Rating value={Number(rev.rating)} readOnly size="small" sx={{ mb: 0.5 }} />
                {rev.comment && (
                  <Typography variant="body2" sx={{ color: 'text.primary', mt: 0.5 }}>
                    {rev.comment}
                  </Typography>
                )}
              </Paper>
            ))}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} variant="contained" color="inherit">
          Закрыть
        </Button>
      </DialogActions>
    </Dialog>
  );
}
