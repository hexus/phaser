/**
 * @author       Richard Davey <rich@photonstorm.com>
 * @author       Felipe Alfonso <@bitnenfer>
 * @copyright    2020 Photon Storm Ltd.
 * @license      {@link https://opensource.org/licenses/MIT|MIT License}
 */

var Class = require('../../../utils/Class');
var GetFastValue = require('../../../utils/object/GetFastValue');
var LightShaderSourceFS = require('../shaders/Light-frag.js');
var MultiPipeline = require('./MultiPipeline');
var Vec2 = require('../../../math/Vector2');
var WebGLPipeline = require('../WebGLPipeline');

var LIGHT_COUNT = 10;
var tempVec2 = new Vec2();

/**
 * @classdesc
 * The Light Pipeline is an extension of the Multi Pipeline and uses a custom shader
 * designed to handle forward diffused rendering of 2D lights in a Scene.
 *
 * The shader works in tandem with Light Game Objects, and optionally texture normal maps,
 * to provide an ambient illumination effect.
 *
 * If you wish to provide your own shader, you can use the `%LIGHT_COUNT%` declaration in the source,
 * and it will be automatically replaced at run-time with the total number of configured lights.
 *
 * The maximum number of lights can be set in the Render Config `maxLights` property and defaults to 10.
 *
 * Prior to Phaser v3.50 this pipeline was called the `ForwardDiffuseLightPipeline`.
 *
 * The fragment shader it uses can be found in `shaders/src/Light.frag`.
 * The vertex shader it uses can be found in `shaders/src/Multi.vert`.
 *
 * The default shader attributes for this pipeline are:
 *
 * `inPosition` (vec2, offset 0)
 * `inTexCoord` (vec2, offset 8)
 * `inTexId` (float, offset 16)
 * `inTintEffect` (float, offset 20)
 * `inTint` (vec4, offset 24, normalized)
 *
 * The default shader uniforms for this pipeline are:
 *
 * `uProjectionMatrix` (mat4)
 * `uViewMatrix` (mat4)
 * `uModelMatrix` (mat4)
 * `uMainSampler` (sampler2D)
 * `uNormSampler` (sampler2D)
 * `uCamera` (vec4)
 * `uResolution` (vec2)
 * `uAmbientLightColor` (vec3)
 * `uInverseRotationMatrix` (mat3)
 * `uLights` (Light struct)
 *
 * @class LightPipeline
 * @extends Phaser.Renderer.WebGL.Pipelines.MultiPipeline
 * @memberof Phaser.Renderer.WebGL.Pipelines
 * @constructor
 * @since 3.50.0
 *
 * @param {Phaser.Types.Renderer.WebGL.WebGLPipelineConfig} config - The configuration options for this pipeline.
 */
var LightPipeline = new Class({

    Extends: MultiPipeline,

    initialize:

    function LightPipeline (config)
    {
        LIGHT_COUNT = config.game.renderer.config.maxLights;

        config.fragShader = GetFastValue(config, 'fragShader', LightShaderSourceFS).replace('%LIGHT_COUNT%', LIGHT_COUNT.toString());

        MultiPipeline.call(this, config);

        /**
         * Inverse rotation matrix for normal map rotations.
         *
         * @name Phaser.Renderer.WebGL.Pipelines.LightPipeline#inverseRotationMatrix
         * @type {Float32Array}
         * @private
         * @since 3.16.0
         */
        this.inverseRotationMatrix = new Float32Array([
            1, 0, 0,
            0, 1, 0,
            0, 0, 1
        ]);

        /**
         * Stores a default normal map, which is an object with a `glTexture` property that
         * maps to a 1x1 texture of the color #7f7fff created in the `boot` method.
         *
         * @name Phaser.Renderer.WebGL.Pipelines.LightPipeline#defaultNormalMap
         * @type {object}
         * @since 3.50.0
         */
        this.defaultNormalMap;
    },

    /**
     * Called when the Game has fully booted and the Renderer has finished setting up.
     *
     * By this stage all Game level systems are now in place and you can perform any final
     * tasks that the pipeline may need that relied on game systems such as the Texture Manager.
     *
     * @method Phaser.Renderer.WebGL.Pipelines.LightPipeline#boot
     * @since 3.11.0
     */
    boot: function ()
    {
        WebGLPipeline.prototype.boot.call(this);

        var gl = this.gl;

        var tempTexture = gl.createTexture();

        gl.activeTexture(gl.TEXTURE0);

        gl.bindTexture(gl.TEXTURE_2D, tempTexture);

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([ 127, 127, 255, 255 ]));

        this.defaultNormalMap = { glTexture: tempTexture };
    },

    onActive: function ()
    {
        this.renderer.resetTextures();

        this.set1i('uMainSampler', 0);
        this.set1i('uNormSampler', 1);
        this.set2f('uResolution', this.width / 2, this.height / 2);
    },

    /**
     * This function sets all the needed resources for each camera pass.
     *
     * @method Phaser.Renderer.WebGL.Pipelines.LightPipeline#onRender
     * @ignore
     * @since 3.0.0
     *
     * @param {Phaser.Scene} scene - The Scene being rendered.
     * @param {Phaser.Cameras.Scene2D.Camera} camera - The Scene Camera being rendered with.
     */
    onRender: function (scene, camera)
    {
        var lightManager = scene.sys.lights;

        if (!lightManager || lightManager.lights.length <= 0 || !lightManager.active)
        {
            return;
        }

        var lights = lightManager.getLights(camera);

        var renderer = this.renderer;
        var cameraMatrix = camera.matrix;
        var height = renderer.height;
        var i;

        for (i = 0; i < LIGHT_COUNT; i++)
        {
            this.set1f('uLights[' + i + '].radius', 0);
        }

        this.set4f('uCamera', camera.x, camera.y, camera.rotation, camera.zoom);

        this.set3f('uAmbientLightColor', lightManager.ambientColor.r, lightManager.ambientColor.g, lightManager.ambientColor.b);

        for (i = 0; i < lights.length; i++)
        {
            var light = lights[i].light;
            var color = light.color;

            var lightName = 'uLights[' + i + '].';

            cameraMatrix.transformPoint(light.x, light.y, tempVec2);

            this.set2f(lightName + 'position', tempVec2.x - (camera.scrollX * light.scrollFactorX * camera.zoom), height - (tempVec2.y - (camera.scrollY * light.scrollFactorY) * camera.zoom));
            this.set3f(lightName + 'color', color.r, color.g, color.b);
            this.set1f(lightName + 'intensity', light.intensity);
            this.set1f(lightName + 'radius', light.radius);
        }

        this.currentNormalMapRotation = null;
    },

    /**
     * Rotates the normal map vectors inversely by the given angle.
     * Only works in 2D space.
     *
     * @method Phaser.Renderer.WebGL.Pipelines.LightPipeline#setNormalMapRotation
     * @since 3.16.0
     *
     * @param {number} rotation - The angle of rotation in radians.
     */
    setNormalMapRotation: function (rotation)
    {
        if (rotation !== this.currentNormalMapRotation || this.vertexCount === 0)
        {
            if (this.vertexCount > 0)
            {
                this.flush();
            }

            var inverseRotationMatrix = this.inverseRotationMatrix;

            if (rotation)
            {
                var rot = -rotation;
                var c = Math.cos(rot);
                var s = Math.sin(rot);

                inverseRotationMatrix[1] = s;
                inverseRotationMatrix[3] = -s;
                inverseRotationMatrix[0] = inverseRotationMatrix[4] = c;
            }
            else
            {
                inverseRotationMatrix[0] = inverseRotationMatrix[4] = 1;
                inverseRotationMatrix[1] = inverseRotationMatrix[3] = 0;
            }

            this.setMatrix3fv('uInverseRotationMatrix', false, inverseRotationMatrix);

            this.currentNormalMapRotation = rotation;
        }
    },

    /**
     * Assigns a texture to the current batch. If a different texture is already set it creates a new batch object.
     *
     * @method Phaser.Renderer.WebGL.Pipelines.LightPipeline#setTexture2D
     * @ignore
     * @since 3.50.0
     *
     * @param {WebGLTexture} [texture] - WebGLTexture that will be assigned to the current batch. If not given uses blankTexture.
     * @param {Phaser.GameObjects.GameObject} [gameObject] - The Game Object being rendered or added to the batch.
     */
    setTexture2D: function (texture, gameObject)
    {
        var renderer = this.renderer;

        if (texture === undefined) { texture = renderer.tempTextures[0]; }

        var normalTexture = this.getNormalMap(gameObject);

        if (renderer.isNewNormalMap(texture, normalTexture))
        {
            this.flush();

            renderer.setTextureZero(texture);
            renderer.setNormalMap(normalTexture);
        }

        var rotation = (gameObject) ? gameObject.rotation : 0;

        this.setNormalMapRotation(rotation);

        this.currentUnit = 0;

        return 0;
    },

    /**
     * Custom pipelines can use this method in order to perform any required pre-batch tasks
     * for the given Game Object. It must return the texture unit the Game Object was assigned.
     *
     * @method Phaser.Renderer.WebGL.Pipelines.LightPipeline#setGameObject
     * @ignore
     * @since 3.50.0
     *
     * @param {Phaser.GameObjects.GameObject} gameObject - The Game Object being rendered or added to the batch.
     * @param {Phaser.Textures.Frame} [frame] - Optional frame to use. Can override that of the Game Object.
     *
     * @return {number} The texture unit the Game Object has been assigned.
     */
    setGameObject: function (gameObject, frame)
    {
        if (frame === undefined) { frame = gameObject.frame; }

        var renderer = this.renderer;
        var texture = frame.glTexture;
        var normalTexture = this.getNormalMap(gameObject);

        if (renderer.isNewNormalMap())
        {
            this.flush();

            renderer.setTextureZero(texture);
            renderer.setNormalMap(normalTexture);
        }

        this.setNormalMapRotation(gameObject.rotation);

        this.currentUnit = 0;

        return 0;
    },

    /**
     * Returns the normal map WebGLTexture from the given Game Object.
     * If the Game Object doesn't have one, it returns the default normal map from this pipeline instead.
     *
     * @method Phaser.Renderer.WebGL.Pipelines.LightPipeline#getNormalMap
     * @since 3.50.0
     *
     * @param {Phaser.GameObjects.GameObject} [gameObject] - The Game Object to get the normal map from.
     *
     * @return {WebGLTexture} The normal map texture.
     */
    getNormalMap: function (gameObject)
    {
        var normalTexture;

        if (!gameObject)
        {
            normalTexture = this.defaultNormalMap;
        }
        else if (gameObject.displayTexture)
        {
            normalTexture = gameObject.displayTexture.dataSource[gameObject.displayFrame.sourceIndex];
        }
        else if (gameObject.texture)
        {
            normalTexture = gameObject.texture.dataSource[gameObject.frame.sourceIndex];
        }
        else if (gameObject.tileset)
        {
            if (Array.isArray(gameObject.tileset))
            {
                normalTexture = gameObject.tileset[0].image.dataSource[0];
            }
            else
            {
                normalTexture = gameObject.tileset.image.dataSource[0];
            }
        }

        if (!normalTexture)
        {
            normalTexture = this.defaultNormalMap;
        }

        return normalTexture.glTexture;
    }

});

LightPipeline.LIGHT_COUNT = LIGHT_COUNT;

module.exports = LightPipeline;
