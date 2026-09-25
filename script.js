"use strict";

// ============================================================
// START AUFGABE 9 – TORUSTEXTUR UND PINGUIN-PORTAL
// ============================================================

const canvas = document.getElementById("webglCanvas");
const gl = canvas.getContext("webgl");

const webglStatus = document.getElementById("webglStatus");
const texturStatus = document.getElementById("texturStatus");
const kameraStatus = document.getElementById("kameraStatus");
const texturButton = document.getElementById("texturButton");
const zuruecksetzenButton = document.getElementById(
    "zuruecksetzenButton"
);

if (!gl) {
    webglStatus.textContent =
        "WebGL wird von diesem Browser nicht unterstützt.";

    webglStatus.style.color = "#8b1e2d";

    throw new Error("WebGL ist nicht verfügbar.");
}

// ------------------------------------------------------------
// Shader
// ------------------------------------------------------------

const vertexShaderQuelle = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec2 aTexCoord;

    uniform mat4 uModel;
    uniform mat4 uView;
    uniform mat4 uProjection;
    uniform mat3 uNormalMatrix;

    varying vec3 vNormal;
    varying vec2 vTexCoord;

    void main() {
        vNormal = normalize(
            uNormalMatrix * aNormal
        );

        vTexCoord = aTexCoord;

        gl_Position =
            uProjection
            * uView
            * uModel
            * vec4(aPosition, 1.0);
    }
`;

const fragmentShaderQuelle = `
    precision mediump float;

    uniform vec3 uColor;
    uniform sampler2D uImageTexture;
    uniform bool uUseTexture;
    uniform bool uUseProcedural;

    varying vec3 vNormal;
    varying vec2 vTexCoord;

    vec3 polarlichtFarbe(vec2 uv) {
        vec3 dunkelblau =
            vec3(0.035, 0.145, 0.235);

        vec3 tuerkis =
            vec3(0.100, 0.760, 0.720);

        vec3 eisblau =
            vec3(0.720, 0.970, 0.950);

        vec3 rosa =
            vec3(0.910, 0.310, 0.570);

        float welle1 = sin(
            uv.y * 22.0
            + sin(uv.x * 12.0) * 3.0
        );

        float welle2 = sin(
            uv.y * 35.0
            - uv.x * 9.0
        );

        float band1 = smoothstep(
            -0.25,
            0.65,
            welle1
        );

        float band2 = smoothstep(
            0.25,
            0.92,
            welle2
        );

        vec3 farbe = mix(
            dunkelblau,
            tuerkis,
            band1
        );

        farbe = mix(
            farbe,
            eisblau,
            band2 * 0.55
        );

        float rosaBand = smoothstep(
            0.72,
            0.98,
            sin(
                uv.y * 17.0
                + uv.x * 8.0
            )
        );

        farbe = mix(
            farbe,
            rosa,
            rosaBand * 0.42
        );

        return farbe;
    }

    void main() {
        vec3 grundfarbe = uColor;

        if (uUseTexture) {
            if (uUseProcedural) {
                grundfarbe =
                    polarlichtFarbe(vTexCoord);
            } else {
                grundfarbe = texture2D(
                    uImageTexture,
                    vTexCoord
                ).rgb;
            }
        }

        vec3 lichtRichtung = normalize(
            vec3(0.45, 0.85, 0.65)
        );

        float helligkeit = max(
            dot(
                normalize(vNormal),
                lichtRichtung
            ),
            0.0
        );

        float beleuchtung =
            0.42 + helligkeit * 0.70;

        vec3 endfarbe =
            grundfarbe * beleuchtung;

        gl_FragColor =
            vec4(endfarbe, 1.0);
    }
`;

function shaderErstellen(typ, quelle) {
    const shader = gl.createShader(typ);

    gl.shaderSource(shader, quelle);
    gl.compileShader(shader);

    if (
        !gl.getShaderParameter(
            shader,
            gl.COMPILE_STATUS
        )
    ) {
        const meldung =
            gl.getShaderInfoLog(shader);

        gl.deleteShader(shader);

        throw new Error(
            "Shader-Fehler: " + meldung
        );
    }

    return shader;
}

function programmErstellen(
    vertexQuelle,
    fragmentQuelle
) {
    const programm =
        gl.createProgram();

    const vertexShader =
        shaderErstellen(
            gl.VERTEX_SHADER,
            vertexQuelle
        );

    const fragmentShader =
        shaderErstellen(
            gl.FRAGMENT_SHADER,
            fragmentQuelle
        );

    gl.attachShader(
        programm,
        vertexShader
    );

    gl.attachShader(
        programm,
        fragmentShader
    );

    gl.linkProgram(programm);

    if (
        !gl.getProgramParameter(
            programm,
            gl.LINK_STATUS
        )
    ) {
        throw new Error(
            "Programm-Fehler: "
            + gl.getProgramInfoLog(programm)
        );
    }

    return programm;
}

const programm = programmErstellen(
    vertexShaderQuelle,
    fragmentShaderQuelle
);

gl.useProgram(programm);

const attribute = {
    position: gl.getAttribLocation(
        programm,
        "aPosition"
    ),

    normal: gl.getAttribLocation(
        programm,
        "aNormal"
    ),

    texCoord: gl.getAttribLocation(
        programm,
        "aTexCoord"
    )
};

const uniforme = {
    model: gl.getUniformLocation(
        programm,
        "uModel"
    ),

    view: gl.getUniformLocation(
        programm,
        "uView"
    ),

    projection: gl.getUniformLocation(
        programm,
        "uProjection"
    ),

    normalMatrix: gl.getUniformLocation(
        programm,
        "uNormalMatrix"
    ),

    color: gl.getUniformLocation(
        programm,
        "uColor"
    ),

    imageTexture: gl.getUniformLocation(
        programm,
        "uImageTexture"
    ),

    useTexture: gl.getUniformLocation(
        programm,
        "uUseTexture"
    ),

    useProcedural: gl.getUniformLocation(
        programm,
        "uUseProcedural"
    )
};

// ------------------------------------------------------------
// Matrizen
// ------------------------------------------------------------

function identitaetsMatrix() {
    return new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ]);
}

function matrizenMultiplizieren(a, b) {
    const ergebnis =
        new Float32Array(16);

    for (
        let spalte = 0;
        spalte < 4;
        spalte += 1
    ) {
        for (
            let zeile = 0;
            zeile < 4;
            zeile += 1
        ) {
            let summe = 0;

            for (
                let index = 0;
                index < 4;
                index += 1
            ) {
                summe +=
                    a[index * 4 + zeile]
                    * b[spalte * 4 + index];
            }

            ergebnis[
                spalte * 4 + zeile
            ] = summe;
        }
    }

    return ergebnis;
}

function verschiebungsMatrix(x, y, z) {
    const matrix =
        identitaetsMatrix();

    matrix[12] = x;
    matrix[13] = y;
    matrix[14] = z;

    return matrix;
}

function skalierungsMatrix(x, y, z) {
    const matrix =
        identitaetsMatrix();

    matrix[0] = x;
    matrix[5] = y;
    matrix[10] = z;

    return matrix;
}

function rotationsMatrixX(winkel) {
    const c = Math.cos(winkel);
    const s = Math.sin(winkel);

    return new Float32Array([
        1, 0, 0, 0,
        0, c, s, 0,
        0, -s, c, 0,
        0, 0, 0, 1
    ]);
}

function rotationsMatrixY(winkel) {
    const c = Math.cos(winkel);
    const s = Math.sin(winkel);

    return new Float32Array([
        c, 0, -s, 0,
        0, 1, 0, 0,
        s, 0, c, 0,
        0, 0, 0, 1
    ]);
}

function rotationsMatrixZ(winkel) {
    const c = Math.cos(winkel);
    const s = Math.sin(winkel);

    return new Float32Array([
        c, s, 0, 0,
        -s, c, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ]);
}

function perspektivMatrix(
    fov,
    seitenverhaeltnis,
    nah,
    fern
) {
    const faktor =
        1 / Math.tan(fov / 2);

    const bereich =
        1 / (nah - fern);

    return new Float32Array([
        faktor / seitenverhaeltnis,
        0,
        0,
        0,

        0,
        faktor,
        0,
        0,

        0,
        0,
        (fern + nah) * bereich,
        -1,

        0,
        0,
        2 * fern * nah * bereich,
        0
    ]);
}

function vektorSubtrahieren(a, b) {
    return [
        a[0] - b[0],
        a[1] - b[1],
        a[2] - b[2]
    ];
}

function kreuzprodukt(a, b) {
    return [
        a[1] * b[2]
            - a[2] * b[1],

        a[2] * b[0]
            - a[0] * b[2],

        a[0] * b[1]
            - a[1] * b[0]
    ];
}

function normalisieren(vektor) {
    const laenge = Math.hypot(
        vektor[0],
        vektor[1],
        vektor[2]
    ) || 1;

    return [
        vektor[0] / laenge,
        vektor[1] / laenge,
        vektor[2] / laenge
    ];
}

function skalarprodukt(a, b) {
    return (
        a[0] * b[0]
        + a[1] * b[1]
        + a[2] * b[2]
    );
}

function lookAtMatrix(
    auge,
    ziel,
    oben
) {
    const zAchse = normalisieren(
        vektorSubtrahieren(
            auge,
            ziel
        )
    );

    const xAchse = normalisieren(
        kreuzprodukt(
            oben,
            zAchse
        )
    );

    const yAchse = kreuzprodukt(
        zAchse,
        xAchse
    );

    return new Float32Array([
        xAchse[0],
        yAchse[0],
        zAchse[0],
        0,

        xAchse[1],
        yAchse[1],
        zAchse[1],
        0,

        xAchse[2],
        yAchse[2],
        zAchse[2],
        0,

        -skalarprodukt(
            xAchse,
            auge
        ),

        -skalarprodukt(
            yAchse,
            auge
        ),

        -skalarprodukt(
            zAchse,
            auge
        ),

        1
    ]);
}

function normalMatrixAusModel(model) {
    const a00 = model[0];
    const a01 = model[1];
    const a02 = model[2];

    const a10 = model[4];
    const a11 = model[5];
    const a12 = model[6];

    const a20 = model[8];
    const a21 = model[9];
    const a22 = model[10];

    const b01 =
        a22 * a11
        - a12 * a21;

    const b11 =
        -a22 * a10
        + a12 * a20;

    const b21 =
        a21 * a10
        - a11 * a20;

    let determinant =
        a00 * b01
        + a01 * b11
        + a02 * b21;

    determinant =
        determinant || 1;

    const invers =
        1 / determinant;

    return new Float32Array([
        b01 * invers,

        (
            -a22 * a01
            + a02 * a21
        ) * invers,

        (
            a12 * a01
            - a02 * a11
        ) * invers,

        b11 * invers,

        (
            a22 * a00
            - a02 * a20
        ) * invers,

        (
            -a12 * a00
            + a02 * a10
        ) * invers,

        b21 * invers,

        (
            -a21 * a00
            + a01 * a20
        ) * invers,

        (
            a11 * a00
            - a01 * a10
        ) * invers
    ]);
}

function modellMatrix(
    position,
    skalierung,
    rotation
) {
    let matrix =
        verschiebungsMatrix(
            position[0],
            position[1],
            position[2]
        );

    matrix =
        matrizenMultiplizieren(
            matrix,
            rotationsMatrixX(
                rotation[0]
            )
        );

    matrix =
        matrizenMultiplizieren(
            matrix,
            rotationsMatrixY(
                rotation[1]
            )
        );

    matrix =
        matrizenMultiplizieren(
            matrix,
            rotationsMatrixZ(
                rotation[2]
            )
        );

    matrix =
        matrizenMultiplizieren(
            matrix,
            skalierungsMatrix(
                skalierung[0],
                skalierung[1],
                skalierung[2]
            )
        );

    return matrix;
}

// ------------------------------------------------------------
// Geometrien
// ------------------------------------------------------------

function torusErstellen(
    hauptRadius = 1.65,
    rohrRadius = 0.48,
    hauptSegmente = 72,
    rohrSegmente = 30
) {
    const positionen = [];
    const normalen = [];
    const texturkoordinaten = [];
    const indizes = [];

    for (
        let i = 0;
        i <= hauptSegmente;
        i += 1
    ) {
        const u =
            i / hauptSegmente;

        const winkelU =
            u * Math.PI * 2;

        for (
            let j = 0;
            j <= rohrSegmente;
            j += 1
        ) {
            const v =
                j / rohrSegmente;

            const winkelV =
                v * Math.PI * 2;

            const cosU =
                Math.cos(winkelU);

            const sinU =
                Math.sin(winkelU);

            const cosV =
                Math.cos(winkelV);

            const sinV =
                Math.sin(winkelV);

            const radius =
                hauptRadius
                + rohrRadius * cosV;

            positionen.push(
                radius * cosU,
                rohrRadius * sinV,
                radius * sinU
            );

            normalen.push(
                cosU * cosV,
                sinV,
                sinU * cosV
            );

            /*
             * u und v legen fest, welcher
             * Bildbereich auf welchem Punkt
             * des Torus dargestellt wird.
             */
            texturkoordinaten.push(
                u,
                v /*+ 0.5*/
            );
        }
    }

    const reihenbreite =
        rohrSegmente + 1;

    for (
        let i = 0;
        i < hauptSegmente;
        i += 1
    ) {
        for (
            let j = 0;
            j < rohrSegmente;
            j += 1
        ) {
            const a =
                i * reihenbreite + j;

            const b =
                (i + 1)
                * reihenbreite
                + j;

            const c = b + 1;
            const d = a + 1;

            indizes.push(
                a,
                b,
                d
            );

            indizes.push(
                b,
                c,
                d
            );
        }
    }

    return {
        positionen,
        normalen,
        texturkoordinaten,
        indizes
    };
}

function kugelErstellen(
    breitenSegmente = 28,
    hoehenSegmente = 20
) {
    const positionen = [];
    const normalen = [];
    const texturkoordinaten = [];
    const indizes = [];

    for (
        let y = 0;
        y <= hoehenSegmente;
        y += 1
    ) {
        const v =
            y / hoehenSegmente;

        const phi =
            v * Math.PI;

        for (
            let x = 0;
            x <= breitenSegmente;
            x += 1
        ) {
            const u =
                x / breitenSegmente;

            const theta =
                u * Math.PI * 2;

            const px =
                Math.sin(phi)
                * Math.cos(theta);

            const py =
                Math.cos(phi);

            const pz =
                Math.sin(phi)
                * Math.sin(theta);

            positionen.push(
                px,
                py,
                pz
            );

            normalen.push(
                px,
                py,
                pz
            );

            texturkoordinaten.push(
                u,
                v
            );
        }
    }

    const reihenbreite =
        breitenSegmente + 1;

    for (
        let y = 0;
        y < hoehenSegmente;
        y += 1
    ) {
        for (
            let x = 0;
            x < breitenSegmente;
            x += 1
        ) {
            const a =
                y * reihenbreite + x;

            const b =
                a + reihenbreite;

            const c = b + 1;
            const d = a + 1;

            indizes.push(
                a,
                b,
                d
            );

            indizes.push(
                b,
                c,
                d
            );
        }
    }

    return {
        positionen,
        normalen,
        texturkoordinaten,
        indizes
    };
}

function kegelErstellen(
    segmente = 30
) {
    const positionen = [];
    const normalen = [];
    const texturkoordinaten = [];
    const indizes = [];

    for (
        let i = 0;
        i <= segmente;
        i += 1
    ) {
        const u =
            i / segmente;

        const winkel =
            u * Math.PI * 2;

        const x =
            Math.cos(winkel);

        const z =
            Math.sin(winkel);

        positionen.push(
            0,
            1,
            0
        );

        normalen.push(
            x * 0.7,
            0.7,
            z * 0.7
        );

        texturkoordinaten.push(
            u,
            1
        );

        positionen.push(
            x,
            -1,
            z
        );

        normalen.push(
            x * 0.7,
            0.7,
            z * 0.7
        );

        texturkoordinaten.push(
            u,
            0
        );
    }

    for (
        let i = 0;
        i < segmente;
        i += 1
    ) {
        const a = i * 2;
        const b = a + 1;
        const c = a + 2;
        const d = a + 3;

        indizes.push(
            a,
            b,
            c
        );

        indizes.push(
            c,
            b,
            d
        );
    }

    return {
        positionen,
        normalen,
        texturkoordinaten,
        indizes
    };
}

function meshErstellen(daten) {
    const mesh = {
        position:
            gl.createBuffer(),

        normal:
            gl.createBuffer(),

        texCoord:
            gl.createBuffer(),

        index:
            gl.createBuffer(),

        anzahl:
            daten.indizes.length
    };

    gl.bindBuffer(
        gl.ARRAY_BUFFER,
        mesh.position
    );

    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(
            daten.positionen
        ),
        gl.STATIC_DRAW
    );

    gl.bindBuffer(
        gl.ARRAY_BUFFER,
        mesh.normal
    );

    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(
            daten.normalen
        ),
        gl.STATIC_DRAW
    );

    gl.bindBuffer(
        gl.ARRAY_BUFFER,
        mesh.texCoord
    );

    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(
            daten.texturkoordinaten
        ),
        gl.STATIC_DRAW
    );

    gl.bindBuffer(
        gl.ELEMENT_ARRAY_BUFFER,
        mesh.index
    );

    gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint16Array(
            daten.indizes
        ),
        gl.STATIC_DRAW
    );

    return mesh;
}

const torusMesh = meshErstellen(
    torusErstellen()
);

const kugelMesh = meshErstellen(
    kugelErstellen()
);

const kegelMesh = meshErstellen(
    kegelErstellen()
);

// ------------------------------------------------------------
// Bildtextur laden
// ------------------------------------------------------------

const bildtextur =
    gl.createTexture();

gl.bindTexture(
    gl.TEXTURE_2D,
    bildtextur
);

/*
 * Ein einzelner türkiser Pixel dient
 * als Platzhalter, bis das Bild vollständig
 * geladen wurde.
 */
gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([
        44,
        153,
        152,
        255
    ])
);

const texturBild =
    new Image();

texturBild.addEventListener(
    "load",
    () => {

        const texturFlaeche =
            document.createElement(
                "canvas"
            );

        texturFlaeche.width = 512;
        texturFlaeche.height = 512;

        const texturKontext =
            texturFlaeche.getContext(
                "2d"
            );

        texturKontext.drawImage(
            texturBild,
            0,
            0,
            texturFlaeche.width,
            texturFlaeche.height
        );

        gl.bindTexture(
            gl.TEXTURE_2D,
            bildtextur
        );

        gl.pixelStorei(
            gl.UNPACK_FLIP_Y_WEBGL,
            true
        );

        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            texturFlaeche
        );

        gl.texParameteri(
            gl.TEXTURE_2D,
            gl.TEXTURE_WRAP_S,
            gl.REPEAT
        );

        gl.texParameteri(
            gl.TEXTURE_2D,
            gl.TEXTURE_WRAP_T,
            gl.REPEAT
        );

        gl.texParameteri(
            gl.TEXTURE_2D,
            gl.TEXTURE_MIN_FILTER,
            gl.LINEAR_MIPMAP_LINEAR
        );

        gl.texParameteri(
            gl.TEXTURE_2D,
            gl.TEXTURE_MAG_FILTER,
            gl.LINEAR
        );

        gl.generateMipmap(
            gl.TEXTURE_2D
        );

        webglStatus.textContent =
            "Das Pinguin-Portal und die individuell gestaltete "
            + "Bildtextur wurden erfolgreich mit WebGL geladen.";

        zeichnen();
    }
);

texturBild.addEventListener(
    "error",
    () => {
        webglStatus.textContent =
            "Die Datei bilder/pinguintextur.png "
            + "konnte nicht geladen werden.";

        webglStatus.style.color =
            "#8b1e2d";
    }
);

texturBild.src =
    "bilder/pinguintextur.png";

// ------------------------------------------------------------
// Kamera und Darstellungszustand
// ------------------------------------------------------------

const kamera = {
    winkel: 0,
    hoehe: 1.15,
    abstand: 8.6
};

let prozeduraleTexturAktiv =
    false;

function kameraZuruecksetzen() {
    kamera.winkel = 0;
    kamera.hoehe = 1.15;
    kamera.abstand = 8.6;

    kameraStatus.textContent =
        "Kamera: Ausgangsposition";

    zeichnen();
}

function texturWechseln() {
    prozeduraleTexturAktiv =
        !prozeduraleTexturAktiv;

    if (prozeduraleTexturAktiv) {
        texturButton.textContent =
            "Bildtextur zeigen";

        texturStatus.textContent =
            "Aktuell: prozedurale Polarlichttextur";
    } else {
        texturButton.textContent =
            "Polarlichttextur zeigen";

        texturStatus.textContent =
            "Aktuell: selbst gestaltete Bildtextur";
    }

    zeichnen();
}

texturButton.addEventListener(
    "click",
    texturWechseln
);

zuruecksetzenButton.addEventListener(
    "click",
    kameraZuruecksetzen
);

window.addEventListener(
    "keydown",
    (event) => {
        const taste = event.key.toLowerCase();

        // Die Textur wechseln.
        if (taste === "t") {
            event.preventDefault();
            texturWechseln();
            return;
        }

        // Kamera zurücksetzen und die Funktion direkt beenden.
        // Dadurch wird die Statusmeldung nicht wieder überschrieben.
        if (taste === "r") {
            event.preventDefault();
            kameraZuruecksetzen();
            return;
        }

        let wurdeBedient = true;

        switch (event.key) {
            case "ArrowLeft":
                kamera.winkel -= Math.PI / 24;
                break;

            case "ArrowRight":
                kamera.winkel += Math.PI / 24;
                break;

            case "ArrowUp":
                kamera.hoehe = Math.min(
                    kamera.hoehe + 0.2,
                    4.2
                );
                break;

            case "ArrowDown":
                kamera.hoehe = Math.max(
                    kamera.hoehe - 0.2,
                    -2.2
                );
                break;

            default:
                wurdeBedient = false;
        }

        if (wurdeBedient) {
            event.preventDefault();

            const grad = Math.round(
                kamera.winkel
                * 180
                / Math.PI
            );

            kameraStatus.textContent =
                `Kamera: Winkel ${grad}°, `
                + `Höhe ${kamera.hoehe.toFixed(2)}`;

            zeichnen();
        }
    }
);

// ------------------------------------------------------------
// Zeichnen einzelner Modelle
// ------------------------------------------------------------

function meshBinden(mesh) {
    gl.bindBuffer(
        gl.ARRAY_BUFFER,
        mesh.position
    );

    gl.vertexAttribPointer(
        attribute.position,
        3,
        gl.FLOAT,
        false,
        0,
        0
    );

    gl.enableVertexAttribArray(
        attribute.position
    );

    gl.bindBuffer(
        gl.ARRAY_BUFFER,
        mesh.normal
    );

    gl.vertexAttribPointer(
        attribute.normal,
        3,
        gl.FLOAT,
        false,
        0,
        0
    );

    gl.enableVertexAttribArray(
        attribute.normal
    );

    gl.bindBuffer(
        gl.ARRAY_BUFFER,
        mesh.texCoord
    );

    gl.vertexAttribPointer(
        attribute.texCoord,
        2,
        gl.FLOAT,
        false,
        0,
        0
    );

    gl.enableVertexAttribArray(
        attribute.texCoord
    );

    gl.bindBuffer(
        gl.ELEMENT_ARRAY_BUFFER,
        mesh.index
    );
}

function modellZeichnen(
    mesh,
    position,
    skalierung,
    rotation,
    farbe,
    verwendetTextur = false
) {
    const model = modellMatrix(
        position,
        skalierung,
        rotation
    );

    gl.uniformMatrix4fv(
        uniforme.model,
        false,
        model
    );

    gl.uniformMatrix3fv(
        uniforme.normalMatrix,
        false,
        normalMatrixAusModel(model)
    );

    gl.uniform3fv(
        uniforme.color,
        farbe
    );

    gl.uniform1i(
        uniforme.useTexture,
        verwendetTextur
    );

    gl.uniform1i(
        uniforme.useProcedural,
        verwendetTextur
        && prozeduraleTexturAktiv
    );

    meshBinden(mesh);

    gl.drawElements(
        gl.TRIANGLES,
        mesh.anzahl,
        gl.UNSIGNED_SHORT,
        0
    );
}

// ------------------------------------------------------------
// Pinguine aus mehreren Grundkörpern
// ------------------------------------------------------------

function pinguinZeichnen(
    x,
    blickrichtung = 1
) {
    const dunkel = [
        0.025,
        0.115,
        0.17
    ];

    const bauch = [
        0.94,
        0.87,
        0.65
    ];

    const weiss = [
        0.96,
        0.98,
        0.96
    ];

    const orange = [
        0.95,
        0.43,
        0.10
    ];

    const braun = [
        0.30,
        0.15,
        0.07
    ];

    // Körper
    modellZeichnen(
        kugelMesh,
        [x, -0.55, 0.35],
        [0.62, 0.98, 0.48],
        [0, 0, 0],
        dunkel
    );

    // Bauch
    modellZeichnen(
        kugelMesh,
        [x, -0.55, 0.76],
        [0.40, 0.72, 0.18],
        [0, 0, 0],
        bauch
    );

    // Kopf
    modellZeichnen(
        kugelMesh,
        [x, 0.42, 0.40],
        [0.55, 0.55, 0.48],
        [0, 0, 0],
        dunkel
    );

    // Gesicht
    modellZeichnen(
        kugelMesh,
        [x, 0.38, 0.79],
        [0.38, 0.35, 0.15],
        [0, 0, 0],
        bauch
    );

    // Linkes Auge
    modellZeichnen(
        kugelMesh,
        [x - 0.15, 0.49, 0.92],
        [0.11, 0.15, 0.07],
        [0, 0, 0],
        weiss
    );

    // Rechtes Auge
    modellZeichnen(
        kugelMesh,
        [x + 0.15, 0.49, 0.92],
        [0.11, 0.15, 0.07],
        [0, 0, 0],
        weiss
    );

    // Linke Pupille
    modellZeichnen(
        kugelMesh,
        [x - 0.15, 0.49, 0.985],
        [0.045, 0.07, 0.035],
        [0, 0, 0],
        braun
    );

    // Rechte Pupille
    modellZeichnen(
        kugelMesh,
        [x + 0.15, 0.49, 0.985],
        [0.045, 0.07, 0.035],
        [0, 0, 0],
        braun
    );

    // Schnabel
    modellZeichnen(
        kegelMesh,
        [x, 0.25, 1.02],
        [0.18, 0.30, 0.12],
        [Math.PI / 2, 0, 0],
        orange
    );

    // Linker Flügel
    modellZeichnen(
        kugelMesh,
        [x - 0.58, -0.45, 0.36],
        [0.18, 0.72, 0.20],
        [
            0,
            0,
            -0.35 * blickrichtung
        ],
        dunkel
    );

    // Rechter Flügel
    modellZeichnen(
        kugelMesh,
        [x + 0.58, -0.45, 0.36],
        [0.18, 0.72, 0.20],
        [
            0,
            0,
            0.35 * blickrichtung
        ],
        dunkel
    );

    // Linker Fuß
    modellZeichnen(
        kugelMesh,
        [x - 0.24, -1.48, 0.60],
        [0.30, 0.10, 0.32],
        [0, 0.12, 0],
        orange
    );

    // Rechter Fuß
    modellZeichnen(
        kugelMesh,
        [x + 0.24, -1.48, 0.60],
        [0.30, 0.10, 0.32],
        [0, -0.12, 0],
        orange
    );
}

// ------------------------------------------------------------
// Gesamte Szene zeichnen
// ------------------------------------------------------------

function zeichnen() {
    gl.viewport(
        0,
        0,
        canvas.width,
        canvas.height
    );

    gl.clearColor(
        0.86,
        0.97,
        0.97,
        1
    );

    gl.clear(
        gl.COLOR_BUFFER_BIT
        | gl.DEPTH_BUFFER_BIT
    );

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);

    gl.cullFace(gl.BACK);

    const seitenverhaeltnis =
        canvas.width
        / canvas.height;

    const projektion =
        perspektivMatrix(
            Math.PI / 4,
            seitenverhaeltnis,
            0.1,
            50
        );

    const auge = [
        Math.sin(kamera.winkel)
            * kamera.abstand,

        kamera.hoehe,

        Math.cos(kamera.winkel)
            * kamera.abstand
    ];

    const ansicht =
        lookAtMatrix(
            auge,
            [0, 0.05, 0],
            [0, 1, 0]
        );

    gl.uniformMatrix4fv(
        uniforme.projection,
        false,
        projektion
    );

    gl.uniformMatrix4fv(
        uniforme.view,
        false,
        ansicht
    );

    gl.activeTexture(
        gl.TEXTURE0
    );

    gl.bindTexture(
        gl.TEXTURE_2D,
        bildtextur
    );

    gl.uniform1i(
        uniforme.imageTexture,
        0
    );

    // Eisscholle
    modellZeichnen(
        kugelMesh,
        [0, -1.65, 0],
        [3.8, 0.16, 2.25],
        [0, 0, 0],
        [0.70, 0.92, 0.93]
    );

    // Texturierter Torus
    modellZeichnen(
        torusMesh,
        [0, 0.20, -0.30],
        [1, 1, 1],
        [Math.PI / 2, 0, 0],
        [1, 1, 1],
        true
    );

    // Zwei Pinguine
    pinguinZeichnen(
        -2.35,
        1
    );

    pinguinZeichnen(
        2.35,
        -1
    );
}

zeichnen();

// ============================================================
// END AUFGABE 9 – TORUSTEXTUR UND PINGUIN-PORTAL
// ============================================================


// ============================================================
// START AUFGABE 9 – SLIDESHOW DES ENTSTEHUNGSPROZESSES
// ============================================================

const fortschrittsbilder = [
    {
        datei:
            "bilder/entwicklung/schritt_01.png",

        titel:
            "Die Pinguin-Bildtextur",

        beschreibung:
            "Die quadratische Bildtextur zeigt verschiedene "
            + "Pinguine auf Eisschollen. Sie wurde passend zur "
            + "Farbwelt des Pinguin-Portals ausgewählt."
    },
    {
        datei:
            "bilder/entwicklung/schritt_02.png",

        titel:
            "Das prozedurale Polarlicht",

        beschreibung:
            "Nach dem Umschalten entsteht die neue Oberfläche "
            + "direkt im Fragment-Shader aus Farben und mehreren "
            + "Sinusfunktionen."
    },
    {
        datei:
            "bilder/entwicklung/schritt_03.png",

        titel:
            "Das Portal aus einer anderen Perspektive",

        beschreibung:
            "Mit den Pfeiltasten wurde die Kameraposition "
            + "verändert. Dadurch lässt sich die texturierte "
            + "Oberfläche des Torus von mehreren Seiten betrachten."
    },
    {
        datei:
            "bilder/entwicklung/schritt_04.png",

        titel:
            "Abschließende Funktionsprüfung",

        beschreibung:
            "Zum Abschluss wurden beide Texturen, die Buttons, "
            + "die Tastatursteuerung und die Kamerabewegung "
            + "getestet. Die Entwicklerkonsole zeigt dabei "
            + "keine Fehlermeldungen."
    }
];

const slideshowBild =
    document.getElementById(
        "slideshowBild"
    );

const bildZaehler =
    document.getElementById(
        "bildZaehler"
    );

const bildTitel =
    document.getElementById(
        "bildTitel"
    );

const bildBeschreibung =
    document.getElementById(
        "bildBeschreibung"
    );

const bildpunkte =
    document.getElementById(
        "bildpunkte"
    );

const zurueckButton =
    document.getElementById(
        "zurueckButton"
    );

const weiterButton =
    document.getElementById(
        "weiterButton"
    );

let aktuellesBild = 0;

function bildpunkteErstellen() {
    bildpunkte.innerHTML = "";

    fortschrittsbilder.forEach(
        (bild, index) => {
            const punkt =
                document.createElement(
                    "button"
                );

            punkt.type = "button";
            punkt.className =
                "schrittpunkt";

            punkt.setAttribute(
                "aria-label",
                `Bild ${index + 1} anzeigen: ${bild.titel}`
            );

            punkt.addEventListener(
                "click",
                () => {
                    aktuellesBild =
                        index;

                    slideshowAktualisieren();
                }
            );

            bildpunkte.appendChild(
                punkt
            );
        }
    );
}

function slideshowAktualisieren() {
    const bild =
        fortschrittsbilder[
            aktuellesBild
        ];

    slideshowBild.src =
        bild.datei;

    slideshowBild.alt =
        bild.titel;

    bildTitel.textContent =
        bild.titel;

    bildBeschreibung.textContent =
        bild.beschreibung;

    bildZaehler.textContent =
        `Bild ${aktuellesBild + 1} `
        + `von ${fortschrittsbilder.length}`;

    const punkte =
        bildpunkte.querySelectorAll(
            ".schrittpunkt"
        );

    punkte.forEach(
        (punkt, index) => {
            punkt.setAttribute(
                "aria-current",
                index === aktuellesBild
                    ? "true"
                    : "false"
            );
        }
    );

    zurueckButton.disabled =
        aktuellesBild === 0;

    weiterButton.disabled =
        aktuellesBild
        === fortschrittsbilder.length - 1;
}

zurueckButton.addEventListener(
    "click",
    () => {
        if (aktuellesBild > 0) {
            aktuellesBild -= 1;
            slideshowAktualisieren();
        }
    }
);

weiterButton.addEventListener(
    "click",
    () => {
        if (
            aktuellesBild
            < fortschrittsbilder.length - 1
        ) {
            aktuellesBild += 1;
            slideshowAktualisieren();
        }
    }
);

bildpunkteErstellen();
slideshowAktualisieren();

// ============================================================
// END AUFGABE 9 – SLIDESHOW DES ENTSTEHUNGSPROZESSES
// ============================================================
