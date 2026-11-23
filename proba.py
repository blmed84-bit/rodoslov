# -*- coding: utf-8 -*-
# Прави пробну датотеку програма са подацима, ВАН репозиторијума.
#   python3 proba.py                      -> са измишљеним подацима (proba-podaci.json, породица Петровић)
#   python3 proba.py "путања/до/Родослов Лакетића.html"  -> са подацима из корисникове датотеке
# Пробна датотека се уписује у привремену фасциклу система и НИКАД не иде у репозиторијум.
import json, os, re, sys, tempfile

T = '<script id="rodoslov-data" type="application/json">'
s = open('rodoslov.html', encoding='utf-8').read()
if len(sys.argv) > 1:
    k = open(sys.argv[1], encoding='utf-8').read()
    a = k.index(T) + len(T)
    podaci = k[a:k.index('</script>', a)].strip()
    d = json.loads(podaci)
    izvor = 'корисникови подаци'
else:
    d = json.load(open('proba-podaci.json', encoding='utf-8'))
    podaci = json.dumps(d, ensure_ascii=False)
    izvor = 'измишљени подаци'
i = s.index(T) + len(T)
j = s.index('</script>', i)
izlaz = os.path.join(tempfile.gettempdir(), 'rodoslov-proba.html')
open(izlaz, 'w', encoding='utf-8').write(s[:i] + '\n' + podaci + '\n' + s[j:])
print('Пробна датотека: %s' % izlaz)
print('Извор: %s — особа %d, бракова %d' % (izvor, len(d.get('persons', [])), len(d.get('marriages', []))))
print('Отвори је у Chrome-у; после пробе је обриши.')
