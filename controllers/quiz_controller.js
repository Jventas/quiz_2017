var models = require("../models");
var Sequelize = require('sequelize');

var paginate = require('../helpers/paginate').paginate;

// Autoload el quiz asociado a :quizId
exports.load = function (req, res, next, quizId) {

    models.Quiz.findById(quizId)
    .then(function (quiz) {
        if (quiz) {
            req.quiz = quiz;
            next();
        } else {
            throw new Error('No existe ningún quiz con id=' + quizId);
        }
    })
    .catch(function (error) {
        next(error);
    });
};


// GET /quizzes
exports.index = function (req, res, next) {

    var countOptions = {};

    // Busquedas:
    var search = req.query.search || '';
    if (search) {
        var search_like = "%" + search.replace(/ +/g,"%") + "%";

        countOptions.where = {question: { $like: search_like }};
    }

    models.Quiz.count(countOptions)
    .then(function (count) {

        // Paginacion:

        var items_per_page = 10;

        // La pagina a mostrar viene en la query
        var pageno = parseInt(req.query.pageno) || 1;

        // Crear un string con el HTML que pinta la botonera de paginacion.
        // Lo añado como una variable local de res para que lo pinte el layout de la aplicacion.
        res.locals.paginate_control = paginate(count, items_per_page, pageno, req.url);

        var findOptions = countOptions;

        findOptions.offset = items_per_page * (pageno - 1);
        findOptions.limit = items_per_page;

        return models.Quiz.findAll(findOptions);
    })
    .then(function (quizzes) {
        res.render('quizzes/index.ejs', {
            quizzes: quizzes,
            search: search
        });
    })
    .catch(function (error) {
        next(error);
    });
};


// GET /quizzes/:quizId
exports.show = function (req, res, next) {

    res.render('quizzes/show', {quiz: req.quiz});
};


// GET /quizzes/new
exports.new = function (req, res, next) {

    var quiz = {question: "", answer: ""};

    res.render('quizzes/new', {quiz: quiz});
};


// POST /quizzes/create
exports.create = function (req, res, next) {

    var quiz = models.Quiz.build({
        question: req.body.question,
        answer: req.body.answer
    });

    // guarda en DB los campos pregunta y respuesta de quiz
    quiz.save({fields: ["question", "answer"]})
    .then(function (quiz) {
        req.flash('success', 'Quiz creado con éxito.');
        res.redirect('/quizzes/' + quiz.id);
    })
    .catch(Sequelize.ValidationError, function (error) {

        req.flash('error', 'Errores en el formulario:');
        for (var i in error.errors) {
            req.flash('error', error.errors[i].value);
        }

        res.render('quizzes/new', {quiz: quiz});
    })
    .catch(function (error) {
        req.flash('error', 'Error al crear un Quiz: ' + error.message);
        next(error);
    });
};


// GET /quizzes/:quizId/edit
exports.edit = function (req, res, next) {

    res.render('quizzes/edit', {quiz: req.quiz});
};


// PUT /quizzes/:quizId
exports.update = function (req, res, next) {

    req.quiz.question = req.body.question;
    req.quiz.answer = req.body.answer;

    req.quiz.save({fields: ["question", "answer"]})
    .then(function (quiz) {
        req.flash('success', 'Quiz editado con éxito.');
        res.redirect('/quizzes/' + req.quiz.id);
    })
    .catch(Sequelize.ValidationError, function (error) {

        req.flash('error', 'Errores en el formulario:');
        for (var i in error.errors) {
            req.flash('error', error.errors[i].value);
        }

        res.render('quizzes/edit', {quiz: req.quiz});
    })
    .catch(function (error) {
        req.flash('error', 'Error al editar el Quiz: ' + error.message);
        next(error);
    });
};


// DELETE /quizzes/:quizId
exports.destroy = function (req, res, next) {

    req.quiz.destroy()
    .then(function () {
        req.flash('success', 'Quiz borrado con éxito.');
        res.redirect('/quizzes');
    })
    .catch(function (error) {
        req.flash('error', 'Error al editar el Quiz: ' + error.message);
        next(error);
    });
};


// GET /quizzes/:quizId/play
exports.play = function (req, res, next) {

    var answer = req.query.answer || '';

    res.render('quizzes/play', {
        quiz: req.quiz,
        answer: answer
    });
};


// GET /quizzes/:quizId/check
exports.check = function (req, res, next) {

    var answer = req.query.answer || "";

    var result = answer.toLowerCase().trim() === req.quiz.answer.toLowerCase().trim();

    res.render('quizzes/result', {
        quiz: req.quiz,
        result: result,
        answer: answer
    });
};

// GET /quizzes/randomplay
exports.randomplay = function (req, res, next) {
    models.Quiz.count()
    .then(function (count) {


        var intAleatorio = Math.floor(Math.random()*(count-1))+1;

        //Opción para no incluir preguntas usadas
        if(!req.session.usadas){
            req.session.usadas = [];
        }

        var arrayUsadas = req.session.usadas.length ? req.session.usadas : (-1);
        var whereOptions = {'id' : {$notIn: arrayUsadas}};
        
        req.session.usadas.push(models.Quiz.findAll({
            where: whereOptions,
            limit: 1,
            offset: intAleatorio
        })[0]); //añadimos al array de usadas
        return req.session.usadas[req.session.usadas.length - 1]; //Pasamos la última pregunta añadida
    })
    .then(function (quiz) { //recibe el quiz de la base de datos
        var aciertos = 0;
        if(req.session.aciertos){
            aciertos = req.session.aciertos;
        } else {
            req.session.aciertos = 0; //La inicializo si no existe
        }
        var totales = models.Quiz.count();

        if(req.session.usadas.length === totales){
            res.render('quizzes/random_nomore', {
                score: req.session.aciertos
             });
        } else {
            res.render('quizzes/random_play.ejs', {
            quiz: quiz,
            score: aciertos
        });
        }
        
    })
    .catch(function (error) {
        next(error);
    });
};

// GET /quizzes/randomcheck/:quizId
exports.randomcheck = function (req, res, next) {
    var answer = req.query.answer || "";

    var result = answer.toLowerCase().trim() === req.quiz.answer.toLowerCase().trim();
    if(result){
        req.session.aciertos++; //Aumentamos los aciertos si ha acertado
    }

    models.Quiz.count()
    .then(function (count) {


        if(req.session.usadas.length === count){
            res.render('quizzes/random_nomore', {
                score: req.session.aciertos
             });
        } else {
            res.render('quizzes/random_result', {
                score: req.session.aciertos,
                result: result,
                answer: answer
             });
        }
    });

    
};
    
