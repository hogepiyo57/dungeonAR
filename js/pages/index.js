// タイトル画面：バージョンを表示する
import { VERSION, RELEASED } from '../common/version.js';

document.getElementById('version').textContent = `ver ${VERSION}（${RELEASED.replaceAll('-', '.')}）`;
