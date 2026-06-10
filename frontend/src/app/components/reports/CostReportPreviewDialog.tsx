import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

type CostReportPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  html: string | null;
};

export function CostReportPreviewDialog({
  open,
  onOpenChange,
  html,
}: CostReportPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle>Pré-visualização do email</DialogTitle>
          <DialogDescription>
            Template actualizado — alocação de custos ReserveHub
          </DialogDescription>
        </DialogHeader>
        {html ? (
          <iframe
            title="Pré-visualização relatório ReserveHub"
            srcDoc={html}
            className="flex-1 w-full border-0 bg-[#eef1f5]"
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
            Sem conteúdo para pré-visualizar.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
