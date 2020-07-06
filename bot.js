//https://discordapp.com/oauth2/authorize?&client_id=668903555662479373&scope=bot&permissions=8
//Requires
const cfg = require("./botcfg.json");
const fs = require('fs');
const Discord = require('discord.js');
const request_Promise = require('request-promise-native');

//Bot cfg
const prefix = cfg.prefix;
const token = cfg.token;
const riotKey = cfg.riot_key;
const userRole = cfg.user_role;

//APIs
const client = new Discord.Client();

//Global Variables
let emblems = 
{
    unranked: "https://i.imgur.com/xJCN4A0.png",
    iron: "https://i.imgur.com/8KgbHbN.png",
	bronze: "https://i.imgur.com/xmMgyGK.png",
	silver: "https://i.imgur.com/9ogFFB7.png",
	gold: "https://i.imgur.com/fILyTYc.png",
	platinum: "https://i.imgur.com/rnS8QzK.png",
	diamond: "https://i.imgur.com/bXAeRKU.png",
	master: "https://i.imgur.com/dFjIgPo.png",
	grandmaster: "https://i.imgur.com/E56WU6Y.png",
	challenger: "https://i.imgur.com/jdxZnAn.png"
}
let riotVersion = 'v4';
let DDragonVersion;
let ChampionMap = new Map();
let EmblemsMap = new Map();
let ChampionsData;
let EmbedColor = [221, 76, 7];
let PlayersFolder = 'players/'

let ActiveGames = new Map();
let ActiveIntervals = new Map();

function sleep(ms)
{
    return new Promise(resolve => setTimeout(resolve, ms));
}

function DDragonVersionRequest()
{
    let DDataDragonVerionURL = "https://ddragon.leagueoflegends.com/api/versions.json";
    return request_Promise(DDataDragonVerionURL, { json: true })
}

function ChampionsDataRequest()
{
    let ChampionDataURL = `https://ddragon.leagueoflegends.com/cdn/${DDragonVersion}/data/en_US/champion.json`;
    return request_Promise(ChampionDataURL, { json: true })
}

async function verifyVersion()
{
    let versions = await DDragonVersionRequest();
    if (DDragonVersion != versions[0])
    {
        DDragonVersion = versions[0];
        let champions = await ChampionsDataRequest()
        ChampionsData = champions;
        mapIdToChampios();
    }
}

function mapIdToChampios()
{
    ChampionMap.clear();
    Object.keys(ChampionsData.data).forEach(k =>
    {
        ChampionMap.set(ChampionsData.data[k].key, ChampionsData.data[k].id);
    });
}

function riotRequest(region, api)
{
    //num++;
    //console.log("Numero de requests: ", num)
    //creates the URL to the riot api
	let riotAPI = `https://${region}.api.riotgames.com`;
	let riotkeyAPI = `?api_key=${riotKey}`;
	let riotURL = riotAPI + api + riotkeyAPI;
	
	//make the request and returns the promise
	return request_Promise(riotURL, { json: true })
}

async function match(discordUser, fromCommand = false)
{
    let userId = discordUser.id.toString();
    let path = PlayersFolder + userId + ".json";
    if (fs.existsSync(path))
    {
        let player = readFile(path);
        if ((player && player.on) || fromCommand)
        {
            try
            {
                await verifyVersion();
                await matchData(player, discordUser);
            }
            catch (err)
            {
                console.log(err);
                discordUser.send("Ocorreu um erro ao obter os dados sobre a partida.");
            }
        }
    }
}

async function matchData(player, discordUser)
{
    let encryptedSummonerId = player.encryptedSummonerId;
    let activeGameAPI = `/lol/spectator/${riotVersion}/active-games/by-summoner/${encryptedSummonerId}`;
    let activeGameData = await riotRequest(player.region, activeGameAPI);
    let gameId = activeGameData.gameId.toString();
    let queueId = activeGameData.gameQueueConfigId;

    let matchEmbeds = [];
    
    let startEmbed = new Discord.RichEmbed();
    startEmbed.setTitle("**Estatísticas da partida atual:**");
    let activeGameName = player.summonerName.toLowerCase().replace(/ /g , "");
    startEmbed.setDescription(`**Tenha um bom jogo!**\nPartida atual: [teemo.gg](https://teemo.gg/player/active/br/${activeGameName})`)
    startEmbed.setColor(EmbedColor);

    if (ActiveGames.has(gameId))
    {
        let numInterval = 0;
        ActiveIntervals.set(discordUser.id, setInterval(()=>
        {
            if (numInterval == 5)
            {
                clearInterval(ActiveIntervals.get(discordUser.id));
                ActiveIntervals.delete(discordUser.id);

                let activegame = ActiveGames.get(gameId);
                clearTimeout(activegame[1]);
                ActiveGames.delete(gameId);

                console.log("Re-coletando");
                matchData(player, discordUser);
            }
            else
            {
                let playerEmbeds = ActiveGames.get(gameId);
                if (playerEmbeds.length != 0)
                {
                    console.log("Re-usando");
                    clearInterval(ActiveIntervals.get(discordUser.id));
                    ActiveIntervals.delete(discordUser.id)
                    
                    discordUser.send(startEmbed);
                    for (let i = 0; i < playerEmbeds[0].length; i++)
                    {
                        sleep(800);
                        discordUser.send(playerEmbeds[0][i]);
                    }
                }
                numInterval++;
            }
        }, 3000));
    }
    else
    {
        console.log("Coletando");
        ActiveGames.set(activeGameData.gameId.toString(), [])
        discordUser.send(startEmbed);

        for (let participant of activeGameData.participants)
        {
            //await sleep(1500);
    
            let sId = participant.summonerId;
            let cId = participant.championId;
            let cName = ChampionMap.get(cId.toString());
            let sName = participant.summonerName;
            let tId =  participant.teamId; //100 -> blue 200 -> red
            let tColor = tId == 100 ? [0,179,255] : [255, 0, 55];
            let icon = participant.profileIconId;
            
            let embed = new Discord.RichEmbed();
            embed.setTitle(`**${sName}**:`);
    
            let sNameTeemo = sName.toLowerCase().replace(/ /g , ""); //connects the first one | replaces the rest
            embed.setDescription(`Sobre este player: [teemo.gg](https://teemo.gg/player/resume/br/${sNameTeemo})`);
            embed.setImage(`https://ddragon.leagueoflegends.com/cdn/${DDragonVersion}/img/champion/${cName}.png`)
            embed.setColor(tColor);
    
            let eloAPI = `/lol/league/${riotVersion}/entries/by-summoner/${sId}`;
            let eloData = await riotRequest(player.region, eloAPI)
            let footer = "";
            let eloURL = "";
    
            if (eloData.length == 0)
            {
                eloURL = emblems.unranked;
                let nameValue = `**${sName} não tem estatísticas essa temporada.**`;
                embed.addField(nameValue, "**Unranked.**");
                footer = "Sem informações sobre win streak."
            }
            else
            {
                let elos = new Map();
                let winStreaks = new Map();
                for (let i = 0; i < eloData.length; i++)
                {
                    let elo = eloData[i].tier;
                    let rank = eloData[i].rank;
                    let lp = eloData[i].leaguePoints;
                    let eloField = `**${elo} ${rank}: ${lp} PDL.**`
                    let hotStreak = eloData[i].hotStreak;
    
                    let type;
                    if (eloData[i].queueType == "RANKED_SOLO_5x5")
                    {
                        elos.set("RANKED_SOLO_5x5", elo);
                        winStreaks.set("RANKED_SOLO_5x5", hotStreak);
    
                        type = "SoloQ";
                    }
                    else if (eloData[i].queueType == "RANKED_FLEX_SR")
                    {
                        elos.set("RANKED_FLEX_SR", elo);
                        winStreaks.set("RANKED_FLEX_SR", hotStreak);
    
                        type = "Flex";
                    }
    
                    let wins = eloData[i].wins;
                    let losses = eloData[i].losses;
                    let winlossField = `\n**Win/Loss: ${wins}/${losses}.**`;
                    let winRate = Math.round((wins/(wins + losses) * 100));
                    let winrateField = `\n**Winrate: ${winRate}%.**`;
                    
                    let fieldValue = eloField + winlossField + winrateField;
    
                    let nameValue = `**Estatísticas ${type}:**`;
                    embed.addField(nameValue, fieldValue) //elo and statistics
                }
    
                let isFlex = (queueId == 440 && elos.has("RANKED_FLEX_SR") && winStreaks.has("RANKED_FLEX_SR"));
                if (isFlex) 
                {
                    eloURL = EmblemsMap.get(elos.get("RANKED_FLEX_SR"));
                    footer = winStreaks.get("RANKED_FLEX_SR") ? "O player está em win streak." :
                                                                "O player não está em win streak."
                }
                else
                {
                    eloURL = elos.has("RANKED_SOLO_5x5") ? EmblemsMap.get(elos.get("RANKED_SOLO_5x5"))
                                                        : EmblemsMap.get(elos.get("RANKED_FLEX_SR"));
    
                    footer = winStreaks.get("RANKED_SOLO_5x5") ? "O player está em win streak." :
                                                                "O player não está em win streak."
                }
            }
            embed.setThumbnail(eloURL);
            embed.setFooter(footer, `https://ddragon.leagueoflegends.com/cdn/${DDragonVersion}/img/profileicon/${icon}.png`);
            discordUser.send(embed);
    
            matchEmbeds.push(embed)
        }
        
        ActiveGames.set(gameId, [matchEmbeds, setTimeout(()=>
        {
            ActiveGames.delete(gameId);
        }, 3 * 60 * 1000)]);
    }
}

function makePlayerObject(name, region, accountId, id, discordId, on = true)
{
    let player = 
    {
        summonerName: name,
        region: region,
        encryptedAccountId: accountId,
        encryptedSummonerId: id,
        discordId: discordId,
        on: on
    }

    return player;
}

function writeFile(path, playerObj)
{
    let playerJSON = JSON.stringify(playerObj, null, 4);
    fs.writeFileSync(path, playerJSON);
}

function readFile(path)
{
    let fileBytes = fs.readFileSync(path); //reads the json file
    return JSON.parse(fileBytes); //transform the raw data to readable data
}

function onOff(path, user, state)
{
    if (fs.existsSync(path))
    {
        let playerObj = readFile(path);
        if (playerObj.on != state)
        {
            playerObj.on = state;
            writeFile(path, playerObj);

            if (state)
                user.send("Modo automático ligado.");
            else
                user.send("Modo automático desligado.");
        }
        else
        {
            if (state)
                user.send("O modo automático já está ligado.")
            else
                user.send("O modo automático já está desligado.")
        }
    }
    else
    {
        user.send(`Você não tem uma conta adicionada | ${prefix}add para adicionar.`);
    }
}

function checkCommand(cont)
{
    if (cont.length == 1 || cont.length == 2) //checks if the command has any argument
    {
        return false;
    }
    else if (cont[1])
    {
        let region = cont[1].toLowerCase();

        let hasRegion = region == "br1" 
                        || region == "eun1" 
                        || region == "euw1" 
                        || region == "jp1" 
                        || region == "kr" 
                        || region == "la1"
                        || region == "la2"
                        || region == "na1"
                        || region == "oc1"
                        || region == "tr1"
                        || region == "ru";
        return hasRegion;
    }
}

function getHelpMsg()
{
    let embed = new Discord.RichEmbed();
    embed.setTitle(`Ajuda:`);
    embed.setDescription(`**1°** Este bot lhe envia automaticamente as estatísticas da partida atual de League of Legends.\n**2°** Para isto funcionar você precisa ativar o compartilhamento de jogo executado (engrenagem no canto inferior esquerdo -> Atividade de jogo -> Mostrar o jogo que está sendo executaddo como seu status), estar disponivel no Discord e estar conectado ao Discord do bot.\n**3°** Para parar de receber notificações use **${prefix}off**, ou desative seu status ou deconecte-se do servidor.\n**4°** Recomendo me silenciar para não ter seu centro de notificações spamado.`);
    embed.setColor(EmbedColor);
    embed.addField(`**${prefix}add**:`, `Como usar: **${prefix}add** "**região**" "**nome de invocador**" (Sem as aspas).\nTe cadastra para começar a receber as notificações.`);
    embed.addField(`**${prefix}edit**:`, `Como usar: **${prefix}edit** "**região**" "**nome de invocador**" (Sem as aspas).\nEdita seu cadastro com o novo nome de invocador.`);
    embed.addField(`**${prefix}profile**:`, `Como usar: **${prefix}profile**.\nMostra as estatísticas do seu perfil.`);
    embed.addField(`**${prefix}match**:`, `Como usar: **${prefix}match**.\nCaso não os dados da partida nao sejam enviados automaticamente use esse comando.`);
    embed.addField(`**${prefix}regions**:`, `Como usar: **${prefix}regions**.\nMostra todas as regiões.`);
    embed.addField(`**${prefix}on**:`, `Como usar: **${prefix}on**.\nLiga as notificações automáticas.`);
    embed.addField(`**${prefix}off**:`, `Como usar: **${prefix}off**.\nDesliga as notificações automáticas.`);
    embed.addField(`**${prefix}bugs**:`, `Como usar: **${prefix}bugs**.\nMostra os bugs atuais.`);
    embed.addField(`**${prefix}help**:`, `Como usar: **${prefix}help**.\nMostra essa mensagem.`);
    return embed
}

client.on('ready', async () =>
{
    // setInterval(() => 
    // {
    //     console.log("Games");
    //     console.log(ActiveGames);
    //     console.log("Intervals");
    //     console.log(ActiveIntervals);
    //     console.log("-----------------------------------------------------");
    // }, 5*1000)

    EmblemsMap.set("IRON", emblems.iron);
    EmblemsMap.set("BRONZE", emblems.bronze);
    EmblemsMap.set("SILVER", emblems.silver);
    EmblemsMap.set("GOLD", emblems.gold);
    EmblemsMap.set("PLATINUM", emblems.platinum);
    EmblemsMap.set("DIAMOND", emblems.diamond);
    EmblemsMap.set("MASTER", emblems.master);
    EmblemsMap.set("GRANDMASTER", emblems.grandmaster);
    EmblemsMap.set("CHALLENGER", emblems.challenger);

    await verifyVersion();
    console.log("Started!!");
})

client.on('message', async msg =>
{
    if (!msg.author.bot && msg.content.startsWith(prefix))//check if the user who sent the message is not the bot
    {			
        let cont = msg.content.split(" ");//split the content by spaces
        cont[0] = cont[0].replace(prefix, '')

        while (cont[1] == '') //remove all the blanks spaces between the cont[0] and cont[1]
        {
            cont.splice(1, 1);
        }
        
        let discordId = msg.author.id.toString();
        let path = PlayersFolder + discordId + ".json";

        switch (cont[0].toLowerCase())
        {
            case "add":
                if (checkCommand(cont))
                {
                    if (!fs.existsSync(path))
                    {
                        try
                        {
                            let summonerName = msg.content.substring(cfg.prefix.length + cont[0].length + 1 + cont[1].length + 1);
                            let formatedSummonerName = summonerName.replace(/ /g, "%20"); //replace " " for %20 to make de request
                            let api = `/lol/summoner/${riotVersion}/summoners/by-name/${formatedSummonerName}`; //makes the api link
                            let region = cont[1].toLowerCase();
                            let data = await riotRequest(region, api) //makes the request to riot's servers
                                
                            let playerObj = makePlayerObject(data.name, region, data.accountId, data.id, discordId);
                            writeFile(path, playerObj)
                            msg.author.send(`Conta adicionado com sucesso: **${data.name}**.\nRegião: **${region}**.`);
                        }
                        catch (err)
                        {
                            msg.author.send("Nome de invocador não encontrado.");
                        }
                        
                    }
                    else
                    {
                        let playerObj = readFile(path);
                        msg.author.send(`Você ja tem uma conta adicionada: **${playerObj.summonerName}**.\nRegião: **${playerObj.region}**.\n**${prefix}edit** para edita-la.`);
                    }
                }
                else
                {
                    msg.author.send("Comando com parâmetros errados.");
                }
                break;

            case "edit":
                if (checkCommand(cont))
                {
                    if (fs.existsSync(path))
                    {
                        try
                        {
                            let summonerName = msg.content.substring(cfg.prefix.length + cont[0].length + 1 + cont[1].length + 1);
                            let formatedSummonerName = summonerName.replace(/ /g, "%20"); //replace " " for %20 to make de request
                            let api = `/lol/summoner/${riotVersion}/summoners/by-name/${formatedSummonerName}`; //makes the api link
                            let region = cont[1].toLowerCase();
                            let data = await riotRequest(region, api);

                            let playerObj = readFile(path);
                            if (playerObj.summonerName == data.name && playerObj.region == region)
                            {
                                msg.author.send(`A conta atual cadastrada já é: **${data.name}**.\nRegião: **${region}**.`)
                            }
                            else
                            {
                                playerObj = makePlayerObject(data.name, region, data.accountId, data.id, discordId);
                                writeFile(path, playerObj);
                                msg.author.send(`Conta editada com sucesso para: **${data.name}**.\nRegião: **${region}**.`);
                            }
                        }
                        catch (err)
                        {
                            msg.author.send("Nome de invocador não encontrado.");
                        }
                        
                    }
                    else
                    {
                        msg.author.send(`Você não tem uma conta adicionada | ${prefix}add para adicionar.`);
                    }
                }
                else
                {
                    msg.author.send("Comando com parâmetros errados.");
                }
                break;

            case "match":
                match(msg.author, true);
                break;

            case "on":
                onOff(path, msg.author, true);
                break;

            case "off":
                onOff(path, msg.author, false);
                break;
            case "regions":
                msg.author.send("Todas as regiões: br1, eun1, euw1, jp1, kr, la1, la2, na1, oc1, tr1, ru.");
                break;

            case "profile":
                if (fs.existsSync(path))
                {
                    try
                    {
                        await verifyVersion();

                        let playerObj = readFile(path);
    
                        let api = `/lol/summoner/v4/summoners/by-account/${playerObj.encryptedAccountId}`;
                        let data = await riotRequest(playerObj.region, api)
    
                        let sName = data.name;
                        if (sName != playerObj.summonerName)
                        {
                            playerObj.summonerName = data.name;
                            writeFile(path, playerObj);
                        }
    
                        let embed = new Discord.RichEmbed();
                        embed.setTitle(`**${sName}**:`);
                        
                        let sNameTeemo = sName.toLowerCase().replace(/ /g , ""); //connects the first one | replaces the rest
                        embed.setDescription(`Sobre este player: [teemo.gg](https://teemo.gg/player/resume/br/${sNameTeemo})`);
                        embed.setColor(EmbedColor);
    
                        let eloAPI = `/lol/league/${riotVersion}/entries/by-summoner/${playerObj.encryptedSummonerId}`;
                        let eloData = await riotRequest(playerObj.region, eloAPI)
    
                        let footer;
                        if (eloData.length == 0)
                        {
                            embed.setThumbnail(emblems.unranked);
    
                            let nameValue = `**Você não tem estatísticas essa temporada.**`;
                            embed.addField(nameValue, "**Unranked.**");
    
                            footer = "Sem informações sobre win streak."
                        }
                        else
                        {
                            let elos = new Map();
                            let winStreaks = new Map();
                            for (let i = 0; i < eloData.length; i++)
                            {
                                let elo = eloData[i].tier;
                                let rank = eloData[i].rank;
                                let lp = eloData[i].leaguePoints;
                                let eloField = `**${elo} ${rank}: ${lp} PDL.**`
                                let hotStreak = eloData[i].hotStreak;
    
                                let type;
                                if (eloData[i].queueType == "RANKED_SOLO_5x5")
                                {
                                    elos.set("RANKED_SOLO_5x5", elo);
                                    winStreaks.set("RANKED_SOLO_5x5", hotStreak);
    
                                    type = "SoloQ";
                                }
                                else if (eloData[i].queueType == "RANKED_FLEX_SR")
                                {
                                    elos.set("RANKED_FLEX_SR", elo);
                                    winStreaks.set("RANKED_FLEX_SR", hotStreak);
    
                                    type = "Flex";
                                }
    
                                let wins = eloData[i].wins;
                                let losses = eloData[i].losses;
                                let winlossField = `\n**Win/Loss: ${wins}/${losses}.**`;
                                let winRate = Math.round((wins/(wins + losses) * 100));
                                let winrateField = `\n**Winrate: ${winRate}%.**`;
                                
                                let fieldValue = eloField + winlossField + winrateField;
    
                                let nameValue = `**Estatísticas ${type}:**`;
                                embed.addField(nameValue, fieldValue) //elo and statistics
                            }
    
                            let eloURL = elos.has("RANKED_SOLO_5x5") ? EmblemsMap.get(elos.get("RANKED_SOLO_5x5")) 
                                                                    : EmblemsMap.get(elos.get("RANKED_FLEX_SR"));
                            embed.setThumbnail(eloURL);
    
                            if (winStreaks.has("RANKED_SOLO_5x5"))
                            {
                                footer = winStreaks.get("RANKED_SOLO_5x5") ? "Você está em win streak."
                                                                            :"Você não está em win streak.";
                            }
                            else
                            {
                                footer = winStreaks.get("RANKED_FLEX_SR") ? "Você está em win streak."
                                                                            :"Você não está em win streak.";
                            }
                        }
                        embed.setFooter(footer, `https://ddragon.leagueoflegends.com/cdn/${DDragonVersion}/img/profileicon/${data.profileIconId}.png`);
                        
                        let championAPI = `/lol/champion-mastery/v4/champion-masteries/by-summoner/${playerObj.encryptedSummonerId}`
                        let championData = await riotRequest(playerObj.region, championAPI)
                        let embedChampions = "";
                        let mainChampion = ChampionMap.get(championData[0].championId.toString());
                        for (let i = 0; i < championData.length; i++)
                        {
                            let championName = ChampionMap.get(championData[i].championId.toString());
                            let mLevel = championData[i].championLevel;
                            let points = championData[i].championPoints;
                            embedChampions += `**${championName} (M${mLevel} ${points} pts)**\n`
                            if (i == 2)
                                break;
                        }
                        embed.addField("**Mains:**", embedChampions);
                        embed.setImage(`https://ddragon.leagueoflegends.com/cdn/${DDragonVersion}/img/champion/${mainChampion}.png`);
                        msg.author.send(embed);
                    }
                    catch (err)
                    {
                        msg.author.send("Ocorreu um erro inesperado ao obter os dados sobre o perfil.")
                    }
                }
                else
                {
                    msg.author.send(`Você não tem uma conta adicionada | ${prefix}add para adicionar.`);
                }
                break;

            case "bugs":
                let bugMsg = "Bugs atuais:";
                let bugs = [];
                bugs.push("Ao dar play em uma música do spotify na seleção de campeão os dados não são enviados.");
                bugs.push("Limitação no número de request feitos pela API da riot por causa do tipo de licensa.");
                bugs.push("Otimizações a serem feitas.");
                bugs.push("Apenas para a região BR.");
                for (let i = 0; i < bugs.length; i++)
                {
                    bugMsg += "\n" + `**${(i + 1).toString()}` + "°** " + bugs[i];
                }
                msg.author.send(bugMsg);
                break;

            case "help":
                msg.author.send(getHelpMsg());
                break;

            default:
                msg.author.send(`Não existe este comando ${prefix}help para mais informações.`);
                break;
        }
    }
});

client.on('presenceUpdate', async (oldUser, newUser) => 
{
    let discordUser = oldUser.user;

    if (!discordUser.bot)
    {
        let discordId = discordUser.id.toString();
        let oldPresences = oldUser.frozenPresence;
        let newPresences = newUser.guild.presences.get(discordId);

        //DEBUG INFO
        {
            // console.log("--------------------------------------------------");
            // console.log("OLD1:\n", oldUser.user.presence)
            // console.log("OLD2:\n", oldPresences)
            // console.log("NEW1:\n", newUser.user.presence)
            // console.log("NEW2:\n", newPresences)
            // console.log("--------------------------------------------------");
        }

        let playing = oldUser.user.presence.game &&
                    oldPresences.game &&
                    newUser.user.presence.game &&
                    newPresences.game ? true : false;

        if (playing)
        {
            let inGame = oldUser.user.presence.game.name == 'League of Legends' &&
                        oldPresences.game.name == 'League of Legends' &&
                        newUser.user.presence.game.name == 'League of Legends' &&
                        newPresences.game.name == 'League of Legends' &&

                        oldUser.user.presence.game.state == 'Em partida' &&
                        oldPresences.game.state == 'Na Seleção de Campeões' &&
                        newUser.user.presence.game.state == 'Em partida' &&
                        newPresences.game.state == 'Em partida';
            
            if (inGame)
                await match(discordUser);
        }
    }
});

client.on('guildMemberAdd', member =>
{
    if (!member.user.bot)
    {
        member.addRole(userRole);
    
        member.user.send("Bem-vindo ao servidor!");
        member.user.send(getHelpMsg());
    }
    else
        member.ban("O usuário é um bot.");
});

client.login(token);
