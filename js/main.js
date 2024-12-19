import helper from "./helper.js";
import iohandler from "./iohandler.js";

function main() {
  const canvas = document.getElementById("myCanvas");
  const gl = canvas.getContext("webgl");
  const obj_path = "/data/pensil.obj";
  const mtl_path = "/data/pensil.mtl";

  if (!gl) {
    console.error("WebGL tidak didukung!");
    return;
  }

  iohandler.initialize(canvas);

  const vertexShaderCode = `
      attribute vec3 aPosition;
      attribute vec3 aNormal;
      uniform mat4 uProj;
      uniform mat4 uView;
      uniform mat4 uModel;
      varying vec3 vNormal;
      varying vec3 vPosition;

      void main() {
          vNormal = aNormal;
          vPosition = vec3(uModel * vec4(aPosition, 1.0));
          gl_Position = uProj * uView * uModel * vec4(aPosition, 1.0);
      }
  `;
  const vertexShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertexShader, vertexShaderCode);
  gl.compileShader(vertexShader);

  const fragmentShaderCode = `
    precision mediump float;
    varying vec3 vNormal;
    varying vec3 vPosition;
    uniform vec3 uDiffuseColor;

    void main() {
        vec3 lightDir1 = normalize(vec3(-1.0, 1.0, 0.0)); // Light from top left
        vec3 lightDir2 = normalize(vec3(-0.5, 0.8, 0.5)); // Broaden the light source
        vec3 normal = normalize(vNormal);
        float lightIntensity1 = max(dot(normal, lightDir1), 0.0);
        float lightIntensity2 = max(dot(normal, lightDir2), 0.0);
        vec3 ambient = 0.3 * uDiffuseColor; // Increase ambient light
        vec3 color = ambient + (0.7 * lightIntensity1 * uDiffuseColor) + (0.3 * lightIntensity2 * uDiffuseColor);
        gl_FragColor = vec4(color, 1.0);
    }
  `;
  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragmentShader, fragmentShaderCode);
  gl.compileShader(fragmentShader);

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.useProgram(program);

  const Pmatrix = gl.getUniformLocation(program, "uProj");
  const Vmatrix = gl.getUniformLocation(program, "uView");
  const Mmatrix = gl.getUniformLocation(program, "uModel");

  const projMatrix = glMatrix.mat4.create();
  const viewMatrix = glMatrix.mat4.create();
  const modMatrix = glMatrix.mat4.create();
  const cumulativeRotation = glMatrix.mat4.create(); // Track cumulative rotation
  glMatrix.mat4.identity(cumulativeRotation);

  glMatrix.mat4.perspective(
    projMatrix,
    glMatrix.glMatrix.toRadian(90),
    canvas.width / canvas.height,
    0.5,
    10.0
  );

  glMatrix.mat4.lookAt(
    viewMatrix,
    [0.0, 4.0, 7.0],
    [0.0, 2.0, -2.0],
    [0.0, 2.0, 3.0]
  );

  const rotationAxisX = [1, 0, 0];
  const rotationAxisY = [0, 1, 0];

  helper.loadOBJWithMTL(
    obj_path,
    mtl_path,
    (vertices, normals, textureCoords, materials, materialGroups) => {
      console.log("Materials:", materials); // Print all materials

      const uDiffuseColor = gl.getUniformLocation(program, "uDiffuseColor");

      const vertexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

      const aPos = gl.getAttribLocation(program, "aPosition");
      gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(aPos);

      const normalBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

      const aNormal = gl.getAttribLocation(program, "aNormal");
      gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(aNormal);

      const indexBuffer = gl.createBuffer();

      function render(time) {
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);

        gl.clearColor(1.0, 1.0, 1.0, 1.0);
        gl.clearDepth(1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const delta = iohandler.getRotationDelta();
        const currentRotation = glMatrix.mat4.create();
        glMatrix.mat4.identity(currentRotation);

        // Apply the current frame's rotation to the cumulative rotation matrix
        helper.rotateObject(currentRotation, delta.x, rotationAxisX);
        helper.rotateObject(currentRotation, delta.y, rotationAxisY);
        glMatrix.mat4.multiply(cumulativeRotation, currentRotation, cumulativeRotation);

        // Use the cumulative rotation matrix for the model matrix
        glMatrix.mat4.copy(modMatrix, cumulativeRotation);
        glMatrix.mat4.scale(modMatrix, modMatrix, [2.0, 2.0, 2.0]);

        gl.uniformMatrix4fv(Pmatrix, false, projMatrix);
        gl.uniformMatrix4fv(Vmatrix, false, viewMatrix);
        gl.uniformMatrix4fv(Mmatrix, false, modMatrix);

        for (const materialName in materialGroups) {
          const indices = materialGroups[materialName];
          let diffuseColor = materials[materialName]?.diffuse || [0.8, 0.8, 0.8];

          if (materialName === "Material.001") {
            diffuseColor = [1.0, 0.5, 0.0]; // kayu ujung pensil
          } else if (materialName === "Material.002") { //badan pensil
            diffuseColor = [0.36, 0.2, 0.09];
          } else if (materialName === "Material.003") { //ujung pensil
            diffuseColor = [0.0, 0.0, 0.0];
          } else if (materialName === "Material.004") { //penghapus pensil
            diffuseColor = [1.0, 0.0, 0.0];
          } else if (materialName === "Material.005") {
            diffuseColor = [0.8, 0.8, 0.8]; // pegangan penghapus
          }

          gl.uniform3fv(uDiffuseColor, new Float32Array(diffuseColor));

          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
          gl.bufferData(
            gl.ELEMENT_ARRAY_BUFFER,
            new Uint16Array(indices),
            gl.STATIC_DRAW
          );

          gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
        }

        window.requestAnimationFrame(render);
      }
      render(1);
    }
  );
}

main();
