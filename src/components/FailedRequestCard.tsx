import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader, RefreshCw, Trash2, Video } from 'lucide-react';
import { motion } from 'framer-motion';

export interface FailedRequestItem {
  id: string;
  user_id?: string;
  user_email?: string;
  video_url: string;
  video_type: string;
  selected_phase?: string | null;
  selected_video_title?: string | null;
  video_details?: string | null;
  promptbegining?: string | null;
  rubric?: Record<string, unknown> | null;
  structuredreturnedconfig?: Record<string, unknown> | null;
  custom_prompt?: string | null;
  custom_context?: string | null;
  request_payload?: Record<string, unknown> | null;
  error_type?: string | null;
  error_message?: string | null;
  created_at: string;
  updated_at?: string;
}

interface FailedRequestCardProps {
  request: FailedRequestItem;
  onRetry: (request: FailedRequestItem) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function FailedRequestCard({ request, onRetry, onDelete }: FailedRequestCardProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const shortUrl = request.video_url?.replace(/^https?:\/\//, '').replace(/\?.*$/, '') || 'Video URL';
  const title = request.selected_video_title || request.selected_phase || 'Failed Evaluation';

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetry(request);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(request.id);
      setIsDeleteDialogOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md border-4 border-foreground bg-card text-foreground shadow-[12px_12px_0px_0px_rgba(13,13,13,1)] rounded-none p-6">
          <DialogHeader className="text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center border-4 border-foreground bg-primary text-3xl font-black text-foreground shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
              !
            </div>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight text-foreground">
              Remove Failed Evaluation?
            </DialogTitle>
            <DialogDescription className="text-base text-muted-foreground font-bold">
              Are you sure you want to delete this failed evaluation request?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4 flex-row justify-end gap-3 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              className="border-4 border-foreground bg-secondary text-foreground hover:bg-secondary/80 font-black uppercase shadow-[4px_4px_0px_0px_rgba(13,13,13,1)] rounded-none"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
              className="border-4 border-foreground bg-primary text-foreground hover:bg-primary/90 font-black uppercase shadow-[4px_4px_0px_0px_rgba(13,13,13,1)] rounded-none"
            >
              {isDeleting ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'OK'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        whileHover={{ scale: 1.02 }}
      >
        <Card className="border-4 border-foreground bg-card shadow-[8px_8px_0px_0px_rgba(13,13,13,1)]">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                <div className="flex h-10 w-10 items-center justify-center border-2 border-foreground bg-accent text-lg font-black">
                  ⏳
                </div>
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-lg font-black uppercase text-foreground line-clamp-2">
                    {request.selected_phase || title}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground font-bold mt-1 line-clamp-2">
                    {request.selected_video_title || 'Video evaluation'}
                  </p>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 text-sm pt-0">
            <div className="flex items-center gap-2 text-foreground font-bold">
              <Video className="w-4 h-4" />
              <span className="truncate">{shortUrl}</span>
            </div>

            <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
              <span>Queued: {new Date(request.created_at).toLocaleDateString()}</span>
              <span>{request.error_type || 'RETRY'}</span>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={handleRetry}
                disabled={isRetrying || isDeleting}
                className="flex-1 border-4 border-foreground bg-secondary text-foreground hover:bg-secondary/80 font-black uppercase shadow-[4px_4px_0px_0px_rgba(13,13,13,1)] rounded-none"
              >
                {isRetrying ? (
                  <>
                    <Loader className="w-3 h-3 mr-1 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Retry
                  </>
                )}
              </Button>

              <Button
                size="sm"
                variant="destructive"
                onClick={() => setIsDeleteDialogOpen(true)}
                disabled={isRetrying || isDeleting}
                className="border-4 border-foreground font-black uppercase shadow-[4px_4px_0px_0px_rgba(13,13,13,1)] rounded-none"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </>
  );
}
