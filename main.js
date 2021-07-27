const path = require('path');
const publicIp = require('public-ip');
const Store = require("jfs");
const jsonDb = new Store(path.join(__dirname, "/userData"));
const bodyParser = require('body-parser');
const express = require('express');
const { config } = require('process');
const appServer = express();
const server = require('http').Server(appServer);
const io = require("socket.io")(server);
let myIp;

jsonDb.get('config', function(error, conf) {
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

    server.listen(conf.serverPort, function() {
        (async() => {
            myIp = await publicIp.v4();
            conf.ip = myIp;
            jsonDb.save('config', conf, function(error) {
                if (error) throw error;
                console.log('Servidor corriendo en ' + conf.domain + ':' + conf.serverPort " [IP: " + conf.ip + "]");
            });
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

        /* FRONT END VIEWS */
        appServer.get('/pasapalabra', (req, res) => {
            res.sendFile(__dirname + '/public/pasapalabra.html');
        })

        appServer.get('/cams', (req, res) => {
            res.sendFile(__dirname + '/public/cams.html');
        })

        appServer.get('/l3', (req, res) => {
            res.sendFile(__dirname + '/public/l3.html');
        })

        appServer.get('/overlay', (req, res) => {
            res.sendFile(__dirname + '/public/overlay.html');
        })

        appServer.get('/image', (req, res) => {
            res.sendFile(__dirname + '/public/image.html');
        })

        /* BACK END VIEWS */
        appServer.get('/panel/info', (req, res) => {
            res.sendFile(__dirname + '/public/panel_info.html');
        })

        appServer.get('/panel/l3', (req, res) => {
            res.sendFile(__dirname + '/public/panel_l3.html');
        })

        appServer.get('/panel/image', (req, res) => {
            res.sendFile(__dirname + '/public/panel_image.html');
        })

        appServer.get('/panel/cam', (req, res) => {
            res.sendFile(__dirname + '/public/panel_cam.html');
        })

        appServer.get('/panel/obs', (req, res) => {
            res.sendFile(__dirname + '/public/panel_obs.html');
        })

        appServer.get('/panel/pasapalabra', (req, res) => {
                res.sendFile(__dirname + '/public/panel_pasapalabra.html');
            })
            /* API REQUESTS */

        /* CAM REQUESTS */
        appServer.get('/request/cam/toggle/:id', toogleCam);
        appServer.get('/request/cam/reset', resetCam);
        appServer.get('/request/cam/names/toggle', toogleNames);
        appServer.post('/request/cam/edit/', editCamInfo);

        /* OBS REQUESTS */
        appServer.get('/request/obs/getScenes', getScenes);
        appServer.get('/request/obs/switchScene/:id', switchScene);

        /* L3 REQUESTS */
        appServer.get('/request/l3/toggle/:id?', tooggleL3);
        appServer.post('/request/l3/edit', editL3);

        /* PASAPALABRA REQUESTS */
        appServer.get('/request/pasapalabra/timer/:seconds?', pasapalabraTimer);
        appServer.post('/request/pasapalabra/edit', editWord);
        appServer.get('/request/pasapalabra/start/', startPasapalabra);
        appServer.get('/request/pasapalabra/checkAnswer/:answer?', checkPasapalabraAnswer);
        appServer.get("/request/pasapalabra/pasapalabra/", doPasapalabra)
        appServer.get("/request/pasapalabra/restart/", pasapalabraRestart)

        /* IMAGE REQUESTS */
        appServer.get('/request/image/toggle/:id?', tooggleImage);
        appServer.post('/request/image/edit', editImage);

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
                l3.lower_thirds[i].image = dataEdit.image;

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

function pasapalabraTimer(req, res) {
    let seconds = req.params.seconds;
    io.emit('pasapalabra_coutdown', {
        "seconds": seconds
    });
    res.send({ result: true });
}

function startPasapalabra(req, res) {
    let dataEdit = req.body;
    jsonDb.get('pasapalabra', function(error, pasapalabra) {
        pasapalabra.position = 0;
        pasapalabra.status = "ONGOING";
        jsonDb.save('pasapalabra', pasapalabra, function(error) {
            if (error) throw error;
            io.emit('pasapalabra_start', {
                "position": pasapalabra.position
            });
        });

        res.send({ result: true });
    })
}

function pasapalabraRestart(req, res) {
    let dataEdit = req.body;
    jsonDb.get('pasapalabra', function(error, pasapalabra) {
        pasapalabra.position = 0;
        pasapalabra.status = "WAITING";
        jsonDb.save('pasapalabra', pasapalabra, function(error) {
            if (error) throw error;
            io.emit('pasapalabra_restart', {
                "position": pasapalabra.position
            });
        });

        res.send({ result: true });
    })
}

function editWord(req, res) {
    let dataEdit = req.body;
    jsonDb.get('pasapalabra', function(error, pasaparalabra) {
        for (let i = 0; pasaparalabra.words.length > i; i++) {
            if (pasaparalabra.words[i].letter == dataEdit.letter) {
                pasaparalabra.words[i].answer = dataEdit.answer;
                pasaparalabra.words[i].condition = dataEdit.condition;
                pasaparalabra.words[i].description = dataEdit.description;
                console.log(pasaparalabra.words[i])
                io.emit('editedWord', {
                    "word": pasaparalabra.words[i]
                });
            }
        }

        jsonDb.save('pasapalabra', pasaparalabra, function(error) {
            if (error) throw error;
        });

        res.send({ result: true });
    })
}

function checkPasapalabraAnswer(req, res) {
    let answer = req.params.answer;
    jsonDb.get('pasapalabra', function(error, pasaparalabra) {
        let position = pasaparalabra.position;
        pasaparalabra.position = pasaparalabra.position + 1;
        jsonDb.save('pasapalabra', pasaparalabra, function(error) {
            if (error) throw error;
            io.emit('pasapalabra_answer', {
                "position": position,
                "answer": answer
            });
            res.send({ result: true });
        });
    });
}

function doPasapalabra(req, res) {
    jsonDb.get('pasapalabra', function(error, pasaparalabra) {
        let position = pasaparalabra.position;
        jsonDb.save('pasapalabra', pasaparalabra, function(error) {
            if (error) throw error;
            io.emit('pasapalabra', {
                "position": position
            });
            res.send({ result: true });
        });
    });
}

function tooggleImage(req, res) {
    let id = req.params.id;
    jsonDb.get('images', function(error, image) {
        image.active = !image.active;
        if (typeof id == "undefined")
            id = image.activeImage;
        for (let i = 0; image.images.length > i; i++) {
            if (image.images[i].id == id) {
                image.activeImage = image.images[i].id;
                io.emit('changeImage', {
                    "active": image.active,
                    "activeImage": image.activeImage,
                    "image": image.images[i]
                });
            }
        }

        if (id == 0)
            io.emit('changeImage', {
                "active": image.active,
                "activeImage": image.activeImage,
                "image": { "title": "", "url": "" }
            });
        jsonDb.save('images', image, function(error) {
            if (error) throw error;
        });
        res.send({ val: image.active });

    })
}

function editImage(req, res) {
    let dataEdit = req.body;
    jsonDb.get('images', function(error, image) {
        for (let i = 0; image.images.length > i; i++) {
            if (image.images[i].id == dataEdit.id) {
                image.images[i].title = dataEdit.title;
                image.images[i].url = dataEdit.url;

                io.emit('editedImage', {
                    "image": image.images[i]
                });
            }
        }
        jsonDb.save('images', image, function(error) {
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

function editCamInfo(req, res) {
    let dataEdit = req.body;
    let prop;
    jsonDb.get('cams', function(error, cams) {
        for (let i = 0; cams.cams.length > i; i++) {
            if (cams.cams[i].id == dataEdit.id) {
                cams.cams[i].nick = dataEdit.nick;
                cams.cams[i].twitter = dataEdit.twitter;
                cams.cams[i].cam = dataEdit.cam;
                prop = cams.cams[i];
            }
        }
        jsonDb.save('cams', cams, function(error) {
            if (error) throw error;
        });

        io.emit('editCamInfo', { "id": dataEdit.id, "prop": prop });

    })
    res.send({ result: true });
}