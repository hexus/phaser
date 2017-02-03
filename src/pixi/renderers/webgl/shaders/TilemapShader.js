/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 *
 * This shader is used to render a batch of tiles stored as a tri-strip with
 * degenerate triangles at the end of each row or group of tiles (A group is a
 * row of tiles with content followed by one or more empty tiles which are not
 * drawn).
 *
 * Settings available are:
 * 
 * uAlpha - the alpha blending factor for a batch draw
 * uCentreOffset - the offset to the centre of the drawing area, in WebGL units (-1...1)
 * uScale - the scaling factor for a batch draw
 * uImageSampler - the source texture containing the tile images
 * aPosition - the attribute set by the batch data for drawing location
 * 
 */

/**
* @class TilemapShader
* @constructor
* @param gl {WebGLContext} the current WebGL drawing context
*/
PIXI.TilemapShader = function(gl)
{
    /**
     * @property _UID
     * @type Number
     * @private
     */
    this._UID = PIXI._UID++;
    
    /**
     * @property gl
     * @type WebGLContext
     */
    this.gl = gl;

    /**
     * The WebGL program.
     * @property program
     * @type Any
     */
    this.program = null;

    this.fragmentSrc = [
        "  precision lowp float;",
        "  uniform sampler2D uImageSampler;",
        "  uniform float uAlpha;",
        "  varying vec2 vTexCoord;",
        "  void main(void) {",
        "    gl_FragColor = texture2D(uImageSampler, vTexCoord) * uAlpha;",
        "  }"
        ];

    this.vertexSrc = [
        "  precision lowp float;",
        "  uniform vec2 uResolution;",
        "  uniform vec2 uSamplerResolution;",
        "  uniform vec2 uCentreOffset;",
        "  uniform vec4 uMatrixScale;",
        "  uniform vec2 uMatrixPos;",
        "  uniform vec2 uScale;",
        "  attribute vec4 aPosition;",
        "  varying vec2 vTexCoord;",
        "  void main(void) {",
        "    gl_Position.zw = vec2(1, 1);",
        
        // Oh hey there vertex
        "    vec2 pos = aPosition.xy;",
        
        // Apply the world matrix
        "    pos.x = uMatrixScale.x * pos.x + uMatrixScale.z * pos.y + uMatrixPos.x;",
        "    pos.y = uMatrixScale.y * pos.x + uMatrixScale.w * pos.y + uMatrixPos.y;",
        
        // Aspect
        "    pos = pos / uResolution * 2.0;",
        "    pos.x = pos.x - 1.0;",
        "    pos.y = 1.0 - pos.y;",
        
        // Et voila
        "    gl_Position.xy = pos.xy;",
        "    vTexCoord = aPosition.zw / uSamplerResolution;",
        "  }"
        ];

    /**
     * A local texture counter for multi-texture shaders.
     * @property textureCount
     * @type Number
     */
    this.textureCount = 0;

    this.init();
};


PIXI.TilemapShader.prototype.constructor = PIXI.TilemapShader;

/**
* Initialises the shader.
* 
* @method init
*/
PIXI.TilemapShader.prototype.init = function()
{
    var gl = this.gl;

    var program = PIXI.compileProgram(gl, this.vertexSrc, this.fragmentSrc);
    gl.useProgram(program);

    // get and store the attributes
    this.aPosition = gl.getAttribLocation(program, 'aPosition');
    this.uSampler = gl.getUniformLocation(program, 'uImageSampler');
    this.uSamplerResolution = gl.getUniformLocation(program, 'uSamplerResolution');
    this.uResolution = gl.getUniformLocation(program, 'uResolution');
    this.uMatrixScale = gl.getUniformLocation(program, 'uMatrixScale');
    this.uMatrixPos = gl.getUniformLocation(program, 'uMatrixPos');
    this.uAlpha = gl.getUniformLocation(program, 'uAlpha');

    this.attributes = [this.aPosition];
    this.uniforms = [this.uCentreOffset, this.uAlpha, this.uScale, this.uSampler];

    this.program = program;
};

/**
* Destroys the shader.
* 
* @method destroy
*/
PIXI.TilemapShader.prototype.destroy = function()
{
    this.gl.deleteProgram( this.program );
    this.gl = null;

    this.uniforms = null;
    this.attributes = null;
};
