export const PRECISION = [0,10,15,25,35,50,50];

export const missions = [
{id:1,name:"Levantamento com Drone",en:"Drone Survey",emoji:"🚁",desc:"Lance o drone e vire completamente o mapa LiDAR.",max:30,ne:true,criteria:[
{key:"drone",label:"Drone já não toca o tapete",points:20},
{key:"map",label:"Bônus: mapa LiDAR completamente virado, marcador de varredura ao menos parcialmente na área de pesquisa",points:10,requires:["drone"]}]},
{id:2,name:"Sementes Explosivas",en:"Exploding Seeds",emoji:"🌰",desc:"Dispare as sementes para que deixem de tocar o caule.",max:30,criteria:[
{key:"seeds",label:"Sementes que já não tocam o caule",points:10,count:3,unit:"semente"}]},
{id:3,name:"Vire a Rocha",en:"Flip the Rock",emoji:"🪨",desc:"Abaixe a bandeira de pesquisa e, se possível, devolva a rocha ao ponto inicial.",max:30,criteria:[
{key:"flag",label:"Bandeira de pesquisa abaixada",points:20},
{key:"rock",label:"Bônus: rocha devolvida à posição inicial",points:10,requires:["flag"]}]},
{id:4,name:"Folhas da Sorte",en:"Lucky Leaves",emoji:"🍃",desc:"Retire folhas do ninho sem tirar o inseto do habitat das folhas (ninho + área marcada no tapete ao redor).",max:30,ne:true,criteria:[
{key:"leaf1",label:"Uma folha completamente removida e sem tocar no ninho",points:10},
{key:"leaf2",label:"Bônus: segunda folha removida (vale só se o inseto nunca saiu completamente do habitat)",points:20,requires:["leaf1"]}],special:"leaf"},
{id:5,name:"Raízes que se Estendem",en:"Reaching Roots",emoji:"🌱",desc:"Estenda a raiz além da fronteira da floresta.",max:20,ne:true,criteria:[
{key:"rootState",label:"Estado da raiz",points:0,choice:[["Não estendida",0],["Parcialmente estendida",10],["Completamente estendida",20]]}]},
{id:6,name:"Correria das Formigas Cortadeiras",en:"Leafcutter Frenzy",emoji:"🐜",desc:"Leve a formiga ao ninho com fragmentos de folhas dentro dele.",max:40,criteria:[
{key:"ant",label:"A formiga está tocando o ninho",points:0},
{key:"fragments",label:"Fragmentos de folhas dentro do ninho (vale 10 cada, são 4; só contam se a formiga toca o ninho)",points:10,count:4,unit:"fragmento",requires:["ant"]}]},
{id:7,name:"Fungo Gigante",en:"Humongous Fungus",emoji:"🍄",desc:"Estenda o micélio e, se possível, conecte-o com a raiz da equipe adversária.",max:40,ne:true,criteria:[
{key:"mycelium",label:"Micélio completamente estendido",points:20},
{key:"bonusOur",label:"Bônus: micélio da nossa equipe conectado à raiz completamente estendida da equipe oposta",points:10,requires:["mycelium"]},
{key:"ourRoot",label:"Nossa raiz está completamente estendida (condição para o bônus recebido)",points:0},
{key:"bonusOther",label:"Bônus: micélio completamente estendido da equipe oposta conectado à nossa raiz completamente estendida",points:10,requires:["ourRoot"]}],special:"fungus"},
{id:8,name:"Emaranhado",en:"Tangled",emoji:"🌿",desc:"Desenrole a trepadeira até que ela toque o tapete.",max:30,criteria:[
{key:"vine",label:"A trepadeira está tocando o tapete",points:30}]},
{id:9,name:"Plataforma de Pesquisa",en:"Research Platform",emoji:"🔬",desc:"Eleve a plataforma, implante a câmera e libere a semente.",max:30,ne:true,criteria:[
{key:"platform",label:"Plataforma de pesquisa elevada",points:10},
{key:"camera",label:"Armadilha fotográfica / câmera implantada",points:10},
{key:"seed",label:"Semente já não toca a árvore",points:10}]},
{id:10,name:"Micro-habitats Frágeis",en:"Fragile Microhabitats",emoji:"🕷️",desc:"Passe pelo ecossistema sem perturbar os habitats.",max:20,ne:true,criteria:[
{key:"spider",label:"Habitat da aranha na posição inicial",points:10},
{key:"snail",label:"Habitat do caracol na posição inicial",points:10}],special:"habitats"},
{id:11,name:"Janela para o Passado",en:"Window to the Past",emoji:"🪟",desc:"Abra a janela de raízes até a cobertura tocar o tapete.",max:20,criteria:[
{key:"cover",label:"Cobertura das raízes abaixada e tocando o tapete",points:20}]},
{id:12,name:"Ancião da Floresta",en:"Forest Elder",emoji:"🌳",desc:"Estabilize a árvore com a bengala e posicione a cinta de suporte.",max:30,ne:true,criteria:[
{key:"cane",label:"Bengala completamente levantada e tocando a árvore",points:20},
{key:"tie",label:"Cinta de suporte ao redor do poste",points:10}]},
{id:13,name:"Espécie-chave",en:"Keystone Species",emoji:"🦜",desc:"Entregue a espécie-chave construída pela equipe e levante as árvores jovens.",max:30,criteria:[
{key:"species",label:"Espécie-chave na plataforma de restauração E árvores jovens levantadas",points:30}],note:"A espécie-chave construída pela equipe conta como equipamento e precisa estar pronta para inspeção."},
{id:14,name:"Sementes da Renovação",en:"Seeds of Renewal",emoji:"🌾",desc:"Deposite as sementes na estação de reflorestamento.",max:30,criteria:[
{key:"stationSeeds",label:"Sementes contidas na estação de reflorestamento (5 cada)",points:5,count:3,unit:"semente"},
{key:"matSeeds",label:"Bônus: dessas sementes, quantas também tocam o tapete? (+5 cada)",points:5,count:3,unit:"semente",requires:["stationSeeds"],nested:true}]},
{id:15,name:"Arquitetura Biocêntrica",en:"Biocentric Architecture",emoji:"🏗️",desc:"Adapte a construção para acolher a biodiversidade.",max:40,ne:true,criteria:[
{key:"canopy",label:"Cobertura de ninhos levantada",points:10},
{key:"compost",label:"Abertura de compostagem totalmente aberta e tocando o tapete",points:10},
{key:"skylight",label:"Claraboia do jardim completamente inserida",points:10},
{key:"envBonus",label:"Bônus ambiental: alteração correspondente ao dock escolhido (ver Estratégia)",points:10}],special:"architecture"}
];
