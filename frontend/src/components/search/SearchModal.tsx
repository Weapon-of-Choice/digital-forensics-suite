import { Dialog, DialogContent } from '../ui/dialog'
import SearchContent from './SearchContent'

export default function SearchModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto p-0">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Search</h2>
          <SearchContent onResultClick={onClose} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
