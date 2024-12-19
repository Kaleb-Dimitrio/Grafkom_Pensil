function loadOBJ(url, callback) {
  fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load OBJ file: ${response.statusText}`);
      }
      return response.text();
    })
    .then((data) => {
      const vertices = [];
      const indices = [];
      const normals = [];
      const textureCoords = [];

      const lines = data.split("\n");
      for (let line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 1) continue; // Skip empty lines

        if (parts[0] === "v") {
          // Vertex position (x, y, z)
          if (parts.length >= 4) {
            vertices.push(
              parseFloat(parts[1]),
              parseFloat(parts[2]),
              parseFloat(parts[3])
            );
          }
        } else if (parts[0] === "vn") {
          // Vertex normal (nx, ny, nz)
          if (parts.length >= 4) {
            normals.push(
              parseFloat(parts[1]),
              parseFloat(parts[2]),
              parseFloat(parts[3])
            );
          }
        } else if (parts[0] === "vt") {
          // Texture coordinate (u, v)
          if (parts.length >= 3) {
            textureCoords.push(parseFloat(parts[1]), parseFloat(parts[2]));
          }
        } else if (parts[0] === "f") {
          // Face (vertices/indices)
          if (parts.length >= 4) {
            parts.slice(1).forEach((part) => {
              const indices = part.split("/");

              // Vertex index (subtract 1 for 0-indexing)
              if (indices[0]) indices[0] = parseInt(indices[0]) - 1;

              // Texture coordinate index
              if (indices[1]) {
                const textureIndex = parseInt(indices[1]) - 1;
                textureCoords.push(textureCoords[textureIndex * 2], textureCoords[textureIndex * 2 + 1]);
              }

              // Normal index
              if (indices[2]) indices[2] = parseInt(indices[2]) - 1;

              indices.push(parseInt(indices[0]));
            });

            // Handle quad (4 vertices) by splitting into two triangles
            if (parts.length - 1 === 4) {
              indices.push(parts[1], parts[2], parts[3]);
              indices.push(parts[1], parts[3], parts[4]);
            } else if (parts.length - 1 === 3) {
              indices.push(parts[1], parts[2], parts[3]);
            }
          }
        }
      }

      callback(vertices, indices, normals, textureCoords);
    })
    .catch((error) => console.error("Error loading OBJ:", error));
}

function parseMTL(text) {
  const materials = {};
  let material;

  const keywords = {
    newmtl(parts, unparsedArgs) {
      material = {};
      materials[unparsedArgs] = material;
    },
    Ns(parts) {
      material.shininess = parseFloat(parts[0]);
    },
    Ka(parts) {
      material.ambient = parts.map(parseFloat);
    },
    Kd(parts) {
      material.diffuse = parts.map(parseFloat);
    },
    Ks(parts) {
      material.specular = parts.map(parseFloat);
    },
    Ke(parts) {
      material.emissive = parts.map(parseFloat);
    },
    Ni(parts) {
      material.opticalDensity = parseFloat(parts[0]);
    },
    d(parts) {
      material.opacity = parseFloat(parts[0]);
    },
    illum(parts) {
      material.illum = parseInt(parts[0]);
    },
  };

  const keywordRE = /(\w*)(?: )*(.*)/;
  const lines = text.split("\n");
  for (let lineNo = 0; lineNo < lines.length; ++lineNo) {
    const line = lines[lineNo].trim();
    if (line === "" || line.startsWith("#")) {
      continue;
    }
    const m = keywordRE.exec(line);
    if (!m) {
      continue;
    }
    const [, keyword, unparsedArgs] = m;
    const parts = line.split(/\s+/).slice(1);
    const handler = keywords[keyword];
    if (!handler) {
      console.warn("unhandled keyword:", keyword);
      continue;
    }
    handler(parts, unparsedArgs);
  }

  return materials;
}

function loadOBJWithMTL(objUrl, mtlUrl, callback) {
  fetch(mtlUrl)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load MTL file: ${response.statusText}`);
      }
      return response.text();
    })
    .then((mtlData) => {
      const materials = parseMTL(mtlData);

      fetch(objUrl)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to load OBJ file: ${response.statusText}`);
          }
          return response.text();
        })
        .then((objData) => {
          const vertices = [];
          const normals = [];
          const textureCoords = [];
          const materialGroups = {};
          let currentMaterial = null;

          const lines = objData.split("\n");
          for (let line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length < 1) continue; // Skip empty lines

            if (parts[0] === "v") {
              if (parts.length >= 4) {
                vertices.push(
                  parseFloat(parts[1]),
                  parseFloat(parts[2]),
                  parseFloat(parts[3])
                );
              }
            } else if (parts[0] === "vn") {
              if (parts.length >= 4) {
                normals.push(
                  parseFloat(parts[1]),
                  parseFloat(parts[2]),
                  parseFloat(parts[3])
                );
              }
            } else if (parts[0] === "vt") {
              if (parts.length >= 3) {
                textureCoords.push(parseFloat(parts[1]), parseFloat(parts[2]));
              }
            } else if (parts[0] === "usemtl") {
              // Switch to a new material
              currentMaterial = parts[1];
              if (!materialGroups[currentMaterial]) {
                materialGroups[currentMaterial] = [];
              }
            } else if (parts[0] === "f") {
              if (parts.length >= 4) {
                const faceIndices = parts.slice(1).map((part) => {
                  const indices = part.split("/");
                  return parseInt(indices[0]) - 1;
                });

                if (faceIndices.length === 4) {
                  materialGroups[currentMaterial].push(
                    faceIndices[0],
                    faceIndices[1],
                    faceIndices[2],
                    faceIndices[0],
                    faceIndices[2],
                    faceIndices[3]
                  );
                } else if (faceIndices.length === 3) {
                  materialGroups[currentMaterial].push(...faceIndices);
                } else {
                  console.warn(
                    "Face with unsupported number of vertices:",
                    faceIndices.length
                  );
                }
              }
            }
          }

          callback(vertices, normals, textureCoords, materials, materialGroups);
        })
        .catch((error) => console.error("Error loading OBJ:", error));
    })
    .catch((error) => console.error("Error loading MTL:", error));
}

function rotateObject(matrix, angle, axis) {
  glMatrix.mat4.rotate(matrix, matrix, angle, axis);
}

export default {
  loadOBJ,
  loadOBJWithMTL,
  rotateObject,
};
