var gulp = require('gulp');
var imagemin = require('gulp-imagemin');
var imageminPngquant = require('imagemin-pngquant');
var plumber = require('gulp-plumber');

// Error checking; produce an error rather than crashing.
var onError = function(err) {
  console.log(err.toString());
  this.emit('end');
};


// fetch command line arguments
const arg = (argList => {

  let arg = {}, a, opt, thisOpt, curOpt;
  for (a = 0; a < argList.length; a++) {

    thisOpt = argList[a].trim();
    opt = thisOpt.replace(/^\-+/, '');

    if (opt === thisOpt) {

      // argument value
      if (curOpt) arg[curOpt] = opt;
      curOpt = null;

    }
    else {

      // argument name
      curOpt = opt;
      arg[curOpt] = true;

    }

  }

  return arg;

})(process.argv);
// ### Images
// `gulp images` - Run lossless compression on all the images.
gulp.task('images', function() {
    return gulp.src(arg.dir + '/**/*')
        .pipe(plumber())
        .pipe(
            imagemin([
                imagemin.mozjpeg({
                	quality: 75,
                	progressive: true
                }),
                imageminPngquant({
					quality: [0.6, 0.8]
				}),
                imagemin.gifsicle({
                	interlaced: true
                }),
                imagemin.svgo({
                    plugins: [{ removeUnknownsAndDefaults: false }, { cleanupIDs: false }]
                })
            ],
            {
				verbose: true
			})
        )
        .pipe(plumber.stop())
        .pipe(gulp.dest(arg.dir));
});
