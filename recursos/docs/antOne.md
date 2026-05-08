Olá
Foi notado, mas já corrigido por mim
UM ERRO BEM CHATO, que estava acontecendo.

Da header para baixo, tudo estava rodando bem
assim como na main.

ATÉ que eu fui tentar implementar a footer de forma
tradicional, no HTML.
Só que estava causando um CLS (Cumulative layout shift)
ABSURDOO na página.

Pois bem, depois de um tempo tentando...
notei que o problema era que
como os cards dos produtos são gerados dinamicamente na página
TUOO AQUILO QUE VEM DEPOIS DOS CARDS DOS PRODUTOS DEVE TAMBÉM SER GERADO
DINAMICAMENTE, E tudo que vem antes, pode ser gerado de forma estática
ou melhor... escrito direto no arquivo html(opcional). Isso evita o problema de CLS.

Obrigado.
- Kholson W.
24/01/26

metadados.json >>>
Metadados são definidos como "dados sobre dados". 
Eles funcionam como um conjunto de informações estruturadas que descrevem, 
contextualizam e organizam um ativo digital, arquivo ou documento, 
facilitando sua gestão, busca e entendimento. 
Eles servem para identificar, localizar, avaliar e gerenciar
informações sem a necessidade de analisar o conteúdo principal
(como o texto de um documento ou a imagem de uma foto). 

Valeu.
- Kholson W.
25/01/26