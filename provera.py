# -*- coding: utf-8 -*-
# Провера пре објаве нове верзије програма „Родослов Лакетића“.
# Покретање из корена репозиторијума:  python3 provera.py
# Мора да испише „СВЕ У РЕДУ“. Ако испише „СТОП“, НЕ објављивати.
import json, re, subprocess, sys

greske = []
s = open('rodoslov.html', encoding='utf-8').read()

# 1) у објављеном фајлу не сме бити породичних података
OZNAKA = '<script id="rodoslov-data" type="application/json">'
m = re.search(re.escape(OZNAKA) + r'(.*?)</script>', s, re.S)
if not m:
    greske.append('нема блока rodoslov-data')
else:
    try:
        d = json.loads(m.group(1))
        if d.get('persons') or d.get('marriages'):
            greske.append('у блоку rodoslov-data има особа или бракова — то су приватни подаци, испразнити блок')
        if len(m.group(1)) > 400:
            greske.append('блок rodoslov-data је предугачак (%d знакова) — мора бити празан шаблон' % len(m.group(1)))
    except Exception as e:
        greske.append('блок rodoslov-data није исправан JSON: %s' % e)

# 2) верзија у програму и у verzija.json мора бити иста
v = (re.search(r"APP_VERSION='([0-9.]+)'", s) or [None, ''])[1]
try:
    j = json.load(open('verzija.json', encoding='utf-8'))
except Exception as e:
    j = {}
    greske.append('verzija.json није исправан JSON: %s' % e)
if not v:
    greske.append('у rodoslov.html нема APP_VERSION')
if j.get('verzija') != v:
    greske.append('APP_VERSION (%s) и verzija.json (%s) се не слажу' % (v, j.get('verzija')))
for k in ('novo', 'zasto', 'govor'):
    if not str(j.get(k, '')).strip():
        greske.append('у verzija.json недостаје поље „%s“' % k)

# 3) верзија мора бити ВЕЋА од последње објављене (програм инсталира само већу)
def kljuc(x):
    return [int(a) for a in x.split('.') if a.isdigit()]
try:
    stari = subprocess.run(['git', 'show', 'HEAD:rodoslov.html'], capture_output=True, text=True, encoding='utf-8').stdout
    sv = (re.search(r"APP_VERSION='([0-9.]+)'", stari) or [None, ''])[1]
    if sv and v and stari != s and kljuc(v) <= kljuc(sv):
        greske.append('програм је мењан, а верзија %s није већа од објављене %s' % (v, sv))
except Exception:
    pass

# 4) фајл мора бити цео
if len(s) < 50000:
    greske.append('rodoslov.html је премали (%d) — програм такав фајл одбија' % len(s))
if s.count(OZNAKA) != 1:
    greske.append('елемент ' + OZNAKA + ' мора да постоји тачно једном')

if greske:
    print('СТОП — не објављивати:')
    for g in greske:
        print('  - ' + g)
    sys.exit(1)
print('СВЕ У РЕДУ — верзија %s, фајл %d знакова, без породичних података.' % (v, len(s)))
