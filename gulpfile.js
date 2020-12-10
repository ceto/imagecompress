var gulp = require('gulp');
var imagemin = require('gulp-imagemin');
var imageminPngquant = require('imagemin-pngquant');

// ### Images
// `gulp images` - Run lossless compression on all the images.
gulp.task('images', function() {
    return gulp.src('original/**/*')
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
        .pipe(gulp.dest('compressed'));
});