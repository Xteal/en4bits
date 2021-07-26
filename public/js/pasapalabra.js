$.getJSON("/api/config.json", function(config) {
    var socket = io.connect(config.domain);


    // Variables
    // -----------------------------------------------------------------------------
    let words = [];
    let remainingWords = 25;
    $.getJSON("/api/pasapalabra.json", function(pasapalabra) {
        for (let [questionKey, question] of Object.entries(pasapalabra.words)) {
            words.push(new Word(questionKey, question.letter, question.condition, question.description, question.answer));
        }
        console.log(words)
    });

    var count = 0; // Counter for answered words
    socket.on('pasapalabra_start', function(data) {
        count = data.position;
        $(".circle .item").eq(words[count].idNumber).addClass("item--current");
        $("#js--ng-controls").addClass("hidden");
        $("#js--question-controls").removeClass("hidden");
        $("#js--close").removeClass("hidden");
        showDefinition(count);
        countdown();
    });

    socket.on('pasapalabra_answer', function(data) {
        count = data.position;
        checkAnswer(count, data.answer);
        continuePlaying();
    });

    socket.on('pasapalabra', function(data) {
        console.log(data);
        count = data.position;
        pasapalabra(count);
        continuePlaying();
    });

    socket.on('pasapalabra_restart', function(data) {
        location.reload();
    })




    // Functions
    // -----------------------------------------------------------------------------

    function Word(idNumber, letter, hint, definition, word, correct) {
        this.idNumber = idNumber;
        this.letter = letter;
        this.hint = hint;
        this.definition = definition;
        this.word = word;
        this.correct = null;
    }

    function showDefinition(pos) {
        $("#js--hint").html(words[pos].hint);
        $("#js--definition").html(words[pos].definition);
    }

    function checkAnswer(pos, status) {
        $(".circle .item").removeClass("item--current");
        if (status == 1) {
            let audioSuccess = document.getElementById("success");
            audioSuccess.mute = false;
            audioSuccess.currentTime = 0;
            audioSuccess.play();
            words[pos].correct = true;
            $(".circle .item").eq(words[pos].idNumber).addClass("item--success");

        } else {
            let audioError = document.getElementById("error");
            audioError.mute = false;
            audioError.currentTime = 0;
            audioError.play();
            words[pos].correct = false;
            $(".circle .item").eq(words[pos].idNumber).addClass("item--failure");
        }
        remainingWords--;
        $("#js--score").html(remainingWords);

        $(".circle .item").eq(words[count + 1].idNumber).addClass("item--current");
        return count++;
    }

    function pasapalabra(pos) {
        var w = words.splice(pos, 1)[0];
        words.push(w);
        $(".circle .item").removeClass("item--current");
        $(".circle .item").eq(words[pos].idNumber).addClass("item--current");
        console.log(words);
    }

    function continuePlaying() {
        if (count != 25) {
            $("#js--user-answer").val("");
            showDefinition(count);
        } else {
            endGame();
        }
    }

    var seconds;
    var temp;

    function countdown() {
        seconds = $("#js--timer").html();
        seconds = parseInt(seconds, 10);
        if (seconds == 0) {
            temp = $("#js--timer");
            temp.innerHTML = 0;
            endGame();
            return;
        }
        seconds--;
        temp = $("#js--timer");
        temp.html(seconds);
        fetch(config.domain + "/request/pasapalabra/timer/" + seconds);
        timeoutMyOswego = setTimeout(countdown, 1000);
    }

    function endGame() {
        $("#js--question-controls").addClass("hidden");
        $("#js--pa-controls").removeClass("hidden");
        $("#js--end-title").html("Fin de partida!");
        $("#js--end-subtitle").html(showUserScore());
        $("#js--close").addClass("hidden")
    }

    function showUserScore() {
        var counter = 0;
        for (i = 0; i < words.length; i++) {
            if (words[i].correct == true) {
                counter++;
            }
        }
        return "Has conseguido un total de " + counter + " aciertos.";
    }

    // End the game
    $("#js--close").click(function() {
        endGame();
    });
});