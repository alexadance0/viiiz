import { ClipboardPaste, Copy } from 'lucide-react'

interface Props {
  canPaste: boolean
  onCopy(): void
  onPaste(): void
}

export function StyleTransferActions({ canPaste, onCopy, onPaste }: Props) {
  return <div className="style-transfer-actions"><button type="button" onClick={onCopy}><Copy size={13} />Копировать стиль</button><button type="button" disabled={!canPaste} onClick={onPaste}><ClipboardPaste size={13} />Применить</button></div>
}
