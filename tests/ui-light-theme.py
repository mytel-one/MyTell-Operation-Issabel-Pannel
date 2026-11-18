"""One-time palette migration to the requested white MyTel theme."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
palette = {
    '#020914':'#f3f6fb','#081626':'#ffffff','#23394f':'#dce5ef','#edf5ff':'#172b43','#a7bbd1':'#5d7188','#67b8ff':'#1674c5','#ff9f22':'#ef9d28','#55d7a0':'#168b64','#ff8c94':'#c64e63',
    '#040e19':'#ffffff','#040f1c':'#ffffff','#04111f':'#f8fafc','#06111e':'#f7f9fc','#071423':'#fcfdff','#081727':'#f7f9fc','#0a1929':'#f7f9fc','#0a1c2e':'#ffffff','#0b1b2c':'#ffffff','#0b1c2e':'#f6f9fc','#0b2034':'#eef6ff','#0b211f':'#f0faf5','#0c1928':'#fbfcfe','#0c1d30':'#f8fbff','#0c1e32':'#ffffff','#0c2034':'#f1f5fa','#0d293f':'#eaf4ff','#0f253c':'#f1f6fb','#10243a':'#f0f6fc','#10253b':'#f2f6fb','#10263c':'#edf4fb','#102c47':'#eaf4ff','#102d28':'#e8f6ef','#11273d':'#ffffff',
    '#0a271f':'#eaf7ef','#1a5142':'#c5e8d5','#291e10':'#fff6e7','#2c1420':'#fcecf0','#281e12':'#fffaef','#2b2315':'#fffaee','#2c2416':'#fff7e6','#301c29':'#fcecf0','#302313':'#fff5e3','#382813':'#fff3de',
    '#1a2e43':'#e5ebf2','#1b2d40':'#e4ebf3','#20364d':'#e0e9f2','#20374e':'#dce6f0','#21453c':'#c6e6d6','#234461':'#cfe4f7','#243c54':'#dce7f1','#24483d':'#cde8da','#263f58':'#d7e4f1','#284b6c':'#ccdfef','#293d51':'#dce5ef','#294159':'#d5e2ee','#29415b':'#d7e2ed','#2c4969':'#c7def3','#2d455f':'#d6e2ee','#355778':'#c6ddf2','#365371':'#b8cadc','#456581':'#c9dbea','#493a22':'#f1dab3','#4b6780':'#a9bfd2','#4c82ac':'#88b5dc','#4d2d3b':'#efd1d9','#514025':'#f0dfbf','#5c4727':'#eddaa8','#623344':'#efcbd4','#647287':'#a5b3c3','#6e5029':'#e9d6b7','#78512c':'#edd8ac','#996b31':'#e4ba75','#997040':'#d5a253','#9f6c30':'#d5a253',
    '#7bc2ff':'#196fae','#7f99b5':'#647b91','#8794a8':'#8493a7','#879eb8':'#667d93','#8adcb7':'#16734f','#8da5bf':'#6d8298','#8fa7bd':'#6f8499','#8fabc7':'#698198','#8fceff':'#1a6cad','#8fcfff':'#176eac','#91aac5':'#667f96','#93e0bd':'#18764f','#98b2cd':'#647f98','#9ab7d6':'#5f7994','#9bb0c6':'#61798f','#9bb1c9':'#667e95','#9fbed8':'#5f7c96','#a4d6ff':'#126aaa','#a8bed5':'#5d768f','#a9c5df':'#5f7b94','#b0c6da':'#57728b','#b1cbe4':'#456882','#b2bfd0':'#6b7c8f','#b3c4d7':'#657b90','#b5c9df':'#526e86','#b7cee5':'#496981','#c0d0e2':'#5b738c','#c6d9e9':'#49667e','#c7ddf2':'#456984','#d2e5f6':'#294b67','#d5e2f0':'#344e67','#e3effb':'#29445f','#f3f7fc':'#152c45',
    '#ffa9ad':'#a9384d','#ffb54f':'#c07917','#ffc166':'#a4670c','#ffc478':'#945a0e','#ffcc80':'#a56c15','#ffcf88':'#946218','#ffcf95':'#805715','#ffd08a':'#96641d','#ffd095':'#906018','#ffd396':'#89590f','#0008':'#1b3a5c24',
}
source = ROOT / 'control_panel/themes/default/css/mytel.css'
css = source.read_text(encoding='utf-8-sig')
css = re.sub(r'#[0-9a-fA-F]{3,8}\b', lambda match:palette.get(match[0].lower(),match[0]), css)
css = css.replace('color-scheme:dark','color-scheme:light').replace('navy / blue / amber','white / blue / amber')
css += '''
/* White MyTel finish and deliberate interactive target sizes. */
#controlPanelApplication .mytel-brand,#controlPanelApplication .mytel-wordmark{color:#102a44}
#controlPanelApplication .mytel-metric{box-shadow:0 3px 12px #23476d05}
#controlPanelApplication .mytel-surface{box-shadow:0 4px 18px #23476d04}
#controlPanelApplication .mytel-icon-button{width:44px;height:44px}
#controlPanelApplication .mytel-filters button{min-height:44px}
#controlPanelApplication .mytel-info{min-width:28px;min-height:28px}
#controlPanelApplication .mytel-extension-tools .phone-icon{min-width:28px;min-height:28px;justify-content:center}
@media(max-width:650px){#controlPanelApplication .mytel-icon-button{width:44px;height:44px}#controlPanelApplication .mytel-filters button{min-height:44px}#controlPanelApplication .mytel-extension-body{min-height:138px}#controlPanelApplication .mytel-extension-activity{padding-bottom:35px}#controlPanelApplication .mytel-extension-tools{bottom:0;inset-inline-end:2px;gap:0}#controlPanelApplication .mytel-info,#controlPanelApplication .mytel-extension-tools .phone-icon{min-width:44px;min-height:44px}}
'''
for variant in ['control_panel','control_panel_en']:
    (ROOT / variant / 'themes/default/css/mytel.css').write_text(css.rstrip()+'\n',encoding='utf-8',newline='\n')
    old = ROOT / variant / 'themes/default/css/style.css'
    old.write_text(old.read_text(encoding='utf-8-sig').rstrip()+'\n',encoding='utf-8',newline='\n')
