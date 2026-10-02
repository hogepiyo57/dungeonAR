// 撮影まわり：カウントダウン、フラッシュ、撮影結果の表示と保存

// 3・2・1 のカウントダウン。onTick(残り秒) で効果音などを鳴らせる
export async function countdown(el, seconds, onTick) {
  if (!seconds) return;
  el.hidden = false;
  for (let i = seconds; i > 0; i--) {
    el.textContent = i;
    if (onTick) onTick(i);
    await new Promise((r) => setTimeout(r, 900));
  }
  el.hidden = true;
}

export function flash(el) {
  el.classList.remove('on');
  void el.offsetWidth;
  el.classList.add('on');
}

// 撮影結果モーダル：共有（iPhone/Androidの写真保存）とダウンロードに対応
// 「もう一度とる」で閉じると Promise が解決する
export function showResult(modal, canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const file = new File([blob], `tsubame-${timestamp()}.jpg`, { type: 'image/jpeg' });
      const img = modal.querySelector('img');
      img.src = url;
      modal.hidden = false;

      const shareBtn = modal.querySelector('[data-act="share"]');
      const dlBtn = modal.querySelector('[data-act="download"]');
      const closeBtn = modal.querySelector('[data-act="close"]');
      const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
      shareBtn.hidden = !canShare;

      const cleanup = () => {
        modal.hidden = true;
        URL.revokeObjectURL(url);
        shareBtn.onclick = dlBtn.onclick = closeBtn.onclick = null;
        resolve();
      };
      shareBtn.onclick = async () => {
        try { await navigator.share({ files: [file], title: 'ダンジョンAR' }); } catch { /* キャンセル */ }
      };
      dlBtn.onclick = () => {
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
      };
      closeBtn.onclick = cleanup;
    }, 'image/jpeg', 0.92);
  });
}

function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
