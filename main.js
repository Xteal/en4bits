const path = require('path');
const publicIp = require('public-ip');
const Store = require("jfs");
const jsonDb = new Store(path.join(__dirname, "/userData"));

const express = require('express');
const appServer = express();
const server = require('http').Server(appServer);
const io = require("socket.io")(8080);
const bodyParser = require('body-parser');

const OBSWebSocket = require('obs-websocket-js');
const obs = new OBSWebSocket();
let obsConnect = false;

obs.connect({
    address: 'localhost:4444',
    password: '$up3rSecretP@ssw0rd'
}).then(() => {
    obsConnect = true;
}).catch(err => { // Promise convention dicates you have a catch on every chain.
    console.log(err);
});

obs.on('SwitchScenes', data => {
    console.log(`New Active Scene: ${data.sceneName}`);
});

obs.on('SwitchScenes', data => {
    io.emit('updateScenes', { data })
});
// You must add this handler to avoid uncaught exceptions.
obs.on('error', err => {
    console.error('socket error:', err);
});

let myIp;
let emotes = "";

jsonDb.get("emotes", function(error, emoticons) {
    emotes = emoticons;
    io.emit('botLog', { "author": "BotXteal", "message": "emoticonos cargados!" });
})
jsonDb.get('config', function(error, conf) {
    server.listen(conf.serverPort, function() {
        (async() => {
            myIp = await publicIp.v4();
            console.log('Servidor corriendo en http:/' + myIp + ':' + conf.serverPort);
        })();

        appServer.use(bodyParser.urlencoded({ extended: true }));
        appServer.use(bodyParser.json());
        appServer.use(bodyParser.raw());

        appServer.use(express.static(__dirname + '/public'));
        appServer.use('/api', express.static(__dirname + '/userData'));
        appServer.use('/css', express.static(__dirname + '/public/css'));
        appServer.use('/js', express.static(__dirname + '/public/js'));
        appServer.use('/backgrounds', express.static(__dirname + '/public/img/panic/'));


        /* FRONT END VIEWS */
        appServer.get('/cams', (req, res) => {
            res.sendFile(__dirname + '/public/cams.html');
        })

        appServer.get('/l3', (req, res) => {
            res.sendFile(__dirname + '/public/l3.html');
        })

        appServer.get('/overlay', (req, res) => {
            res.sendFile(__dirname + '/public/overlay.html');
        })

        /* BACK END VIEWS */
        appServer.get('/panel/info', (req, res) => {
            res.sendFile(__dirname + '/public/panel_info.html');
        })

        appServer.get('/panel/l3', (req, res) => {
            res.sendFile(__dirname + '/public/panel_l3.html');
        })

        appServer.get('/panel/cam', (req, res) => {
            res.sendFile(__dirname + '/public/panel_cam.html');
        })

        appServer.get('/panel/obs', (req, res) => {
            res.sendFile(__dirname + '/public/panel_obs.html');
        })

        /* API REQUESTS */

        /* CAM REQUESTS */
        appServer.get('/request/cam/toggle/:id', toogleCam);
        appServer.get('/request/cam/reset', resetCam);
        appServer.get('/request/cam/names/toggle', toogleNames);

        /* OBS REQUESTS */
        appServer.get('/request/obs/getScenes', getScenes);
        appServer.get('/request/obs/switchScene/:id', switchScene);

        /* L3 REQUESTS */
        appServer.get('/request/l3/toggle/:id?', tooggleL3)
        appServer.post('/request/l3/edit', editL3);

        /* INFO REQUESTS */
        appServer.post('/request/info/edit', editInfo)
    });
});

function getScenes(req, res) {
    if (obsConnect) {
        obs.send('GetSceneList').then(data => {
            res.send({ data });
        })
    }

}

function toogleCam(req, res) {
    let id = req.params.id;
    let result = true;
    jsonDb.get('cams', function(error, cams) {
        for (let i = 0; cams.cams.length > i; i++) {
            if (cams.cams[i].id == id) {
                result = cams.cams[i].active;
                editCam(id, !result);
                res.send({ val: !result });

            }
        }
    })
}

function switchScene(req, res) {
    let id = req.params.id;
    if (obsConnect) {
        obs.send('SetCurrentScene', {
            'scene-name': id
        });
        res.send({ val: true })
    }

}

function resetCam(req, res) {
    io.emit('resetCams');
    res.send({ val: true })
}

function toogleNames(req, res) {
    jsonDb.get('cams', function(error, cams) {
        cams.name = !cams.name;

        jsonDb.save('cams', cams, function(error) {
            if (error) throw error;
        });
        io.emit('toggleNames', { "prop": cams.name });
        res.send({ val: cams.name });
    })
}

function tooggleL3(req, res) {
    let id = req.params.id;
    jsonDb.get('lower_thirds', function(error, l3) {
        l3.active = !l3.active;
        if (typeof id == "undefined")
            id = l3.activeId;
        for (let i = 0; l3.lower_thirds.length > i; i++) {
            if (l3.lower_thirds[i].id == id) {
                l3.activeId = l3.lower_thirds[i].id;
                io.emit('changeL3', {
                    "active": l3.active,
                    "activeId": l3.activeId,
                    "l3": l3.lower_thirds[i]
                });
            }
        }

        if (id == 0)
            io.emit('changeL3', {
                "active": l3.active,
                "activeId": l3.activeId,
                "l3": { "title": "", "subtitle": "", "image": "" }
            });
        jsonDb.save('lower_thirds', l3, function(error) {
            if (error) throw error;
        });
        res.send({ val: l3.active });

    })
}

function editL3(req, res) {
    let dataEdit = req.body;
    jsonDb.get('lower_thirds', function(error, l3) {
        for (let i = 0; l3.lower_thirds.length > i; i++) {
            if (l3.lower_thirds[i].id == dataEdit.id) {
                l3.lower_thirds[i].title = dataEdit.title;
                l3.lower_thirds[i].subtitle = dataEdit.subtitle;

                io.emit('editedL3', {
                    "l3": l3.lower_thirds[i]
                });
            }
        }
        jsonDb.save('lower_thirds', l3, function(error) {
            if (error) throw error;
        });

        res.send({ result: true });
    })
}

function editInfo(req, res) {
    let dataEdit = req.body;
    jsonDb.get('info', function(error, info) {
        info.temporada = dataEdit.season;
        info.capitulo = dataEdit.episode;
        info.hashtag = dataEdit.hashtag;
        info.titulo = dataEdit.title;

        io.emit('editedInfo', {
            "info": info
        });
        jsonDb.save('info', info, function(error) {
            if (error) throw error;
        });

        res.send({ result: true });
    })
}


function editCam(id, prop) {
    jsonDb.get('cams', function(error, cams) {
        for (let i = 0; cams.cams.length > i; i++) {
            if (cams.cams[i].id == id) {
                if (cams.cams[i].active) {
                    cams.cams[i].active = false;
                    prop = false;
                } else {
                    cams.cams[i].active = true;
                    prop = true;
                }
            }
        }
        jsonDb.save('cams', cams, function(error) {
            if (error) throw error;
        });

        io.emit('editCam', { "id": id, "prop": prop });

    })
    return prop;
}