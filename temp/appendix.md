Of course. I will meticulously extract the content from all the provided links and notes, organizing everything into a single, comprehensive `appendix.md` file as you've requested.

I will process the content of all **22 links** and integrate it with the provided notes and code snippets. The final document will be structured clearly, preserving all original code and text verbatim.

Here is the `appendix.md` file.

***

# Appendix: Provider SDK & API Reference Guide

This document contains code samples, API documentation, and reference materials for integrating with various AI provider SDKs.

---

## **GOOGLE**

### **Note: Streaming**
We always want to stream responses whenever possible.

*   **Link:** [`generate_content_streaming.ts`](https://github.com/googleapis/js-genai/raw/refs/heads/main/sdk-samples/generate_content_streaming.ts)
*   **Content:**
    ```typescript
    /**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {GoogleGenAI, Modality} from '@google/genai';
import * as fs from 'fs';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION;
const GOOGLE_GENAI_USE_VERTEXAI = process.env.GOOGLE_GENAI_USE_VERTEXAI;

async function generateContentFromMLDev() {
  const ai = new GoogleGenAI({vertexai: false, apiKey: GEMINI_API_KEY});

  const response = await ai.models.generateContentStream({
    model: 'gemini-2.0-flash-exp',
    contents:
      'Generate a story about a cute baby turtle in a 3d digital art style. For each scene, generate an image.',
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
    },
  });

  let i = 0;
  for await (const chunk of response) {
    const text = chunk.text;
    const data = chunk.data;
    if (text) {
      console.debug(text);
    } else if (data) {
      const fileName = `generate_content_streaming_image_${i++}.png`;
      console.debug(`Writing response image to file: ${fileName}.`);
      fs.writeFileSync(fileName, data);
    }
  }
}

async function generateContentFromVertexAI() {
  const ai = new GoogleGenAI({
    vertexai: true,
    project: GOOGLE_CLOUD_PROJECT,
    location: GOOGLE_CLOUD_LOCATION,
  });

  const response = await ai.models.generateContentStream({
    model: 'gemini-2.0-flash-exp',
    contents:
      'Generate a story about a cute baby turtle in a 3d digital art style. For each scene, generate an image.',
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
    },
  });

  let i = 0;
  for await (const chunk of response) {
    const text = chunk.text;
    const data = chunk.data;
    if (text) {
      console.debug(text);
    } else if (data) {
      const fileName = `generate_content_streaming_image_${i++}.png`;
      console.debug(`Writing response image to file: ${fileName}.`);
      fs.writeFileSync(fileName, data);
    }
  }
}

async function main() {
  if (GOOGLE_GENAI_USE_VERTEXAI) {
    await generateContentFromVertexAI().catch((e) =>
      console.error('got error', e),
    );
  } else {
    await generateContentFromMLDev().catch((e) =>
      console.error('got error', e),
    );
  }
}

main();
    ```

### **Note: Vision & File Uploads**
*   `ai.files.upload` parameters contain a `file` field which only accepts blob or string (file name).
*   **Link:** [`generate_content_with_file_upload.ts`](https://github.com/googleapis/js-genai/raw/refs/heads/main/sdk-samples/generate_content_with_file_upload.ts)
*   **Content:**
    ```typescript
    /**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {ContentListUnion, createPartFromUri, GoogleGenAI} from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_GENAI_USE_VERTEXAI = process.env.GOOGLE_GENAI_USE_VERTEXAI;

async function generateContentFromFileUploadMLDev() {
  const ai = new GoogleGenAI({vertexai: false, apiKey: GEMINI_API_KEY});
  const testFile = new Blob(
    [
      'The Whispering Woods In the heart of Eldergrove, there stood a forest whispered about by the villagers. They spoke of trees that could talk and streams that sang. Young Elara, curious and adventurous, decided to explore the woods one crisp autumn morning. As she wandered deeper, the leaves rustled with excitement, revealing hidden paths. Elara noticed the trees bending slightly as if beckoning her to come closer. When she paused to listen, she heard soft murmurs—stories of lost treasures and forgotten dreams. Drawn by the enchanting sounds, she followed a narrow trail until she stumbled upon a shimmering pond. At its edge, a wise old willow tree spoke, “Child of the village, what do you seek?” “I seek adventure,” Elara replied, her heart racing. “Adventure lies not in faraway lands but within your spirit,” the willow said, swaying gently. “Every choice you make is a step into the unknown.” With newfound courage, Elara left the woods, her mind buzzing with possibilities. The villagers would say the woods were magical, but to Elara, it was the spark of her imagination that had transformed her ordinary world into a realm of endless adventures. She smiled, knowing her journey was just beginning',
    ],
    {type: 'text/plain'},
  );

  // Upload the file.
  const file = await ai.files.upload({
    file: testFile,
    config: {
      displayName: 'generate_file.txt',
    },
  });

  // Wait for the file to be processed.
  let getFile = await ai.files.get({name: file.name as string});
  while (getFile.state === 'PROCESSING') {
    getFile = await ai.files.get({name: file.name as string});
    console.log(`current file status: ${getFile.state}`);
    console.log('File is still processing, retrying in 5 seconds');

    await new Promise((resolve) => {
      setTimeout(resolve, 5000);
    });
  }
  if (file.state === 'FAILED') {
    throw new Error('File processing failed.');
  }

  // Add the file to the contents.
  const content: ContentListUnion = [
    'Summarize the story in a single sentence.',
  ];

  if (file.uri && file.mimeType) {
    const fileContent = createPartFromUri(file.uri, file.mimeType);
    content.push(fileContent);
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: content,
  });

  console.debug(response.text);
}

async function main() {
  if (GOOGLE_GENAI_USE_VERTEXAI) {
    throw new Error('Vertex AI is not supported for this sample.');
  } else {
    await generateContentFromFileUploadMLDev().catch((e) =>
      console.error('got error', e),
    );
  }
}

main();
    ```

### **Note: Web Search (Search Grounding & URL Context)**

#### **Search Grounding**
*   **Link:** [`generate_content_with_search_grounding.ts`](https://github.com/googleapis/js-genai/raw/refs/heads/main/sdk-samples/generate_content_with_search_grounding.ts)
*   **Content:**
    ```typescript
    /**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {GoogleGenAI} from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION;
const GOOGLE_GENAI_USE_VERTEXAI = process.env.GOOGLE_GENAI_USE_VERTEXAI;

async function generateContentFromMLDev() {
  const ai = new GoogleGenAI({vertexai: false, apiKey: GEMINI_API_KEY});
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents:
      'What is the sum of the first 50 prime numbers? Generate and run code for the calculation, and make sure you get all 50.',
    config: {
      tools: [{googleSearch: {}}],
    },
  });
  console.debug(JSON.stringify(response?.candidates?.[0]?.groundingMetadata));
}

async function generateContentFromVertexAI() {
  const ai = new GoogleGenAI({
    vertexai: true,
    project: GOOGLE_CLOUD_PROJECT,
    location: GOOGLE_CLOUD_LOCATION,
  });
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents:
      'What is the sum of the first 50 prime numbers? Generate and run code for the calculation, and make sure you get all 50.',
    config: {
      tools: [{googleSearch: {}}],
    },
  });
  console.debug(JSON.stringify(response?.candidates?.[0]?.groundingMetadata));
}

async function main() {
  if (GOOGLE_GENAI_USE_VERTEXAI) {
    await generateContentFromVertexAI().catch((e) =>
      console.error('got error', e),
    );
  } else {
    await generateContentFromMLDev().catch((e) =>
      console.error('got error', e),
    );
  }
}

main();
    ```

#### **Citations Handling with Search Grounding**
*   **Note:** We have some works on source citations already in `#file:MessageList.tsx` and `#file:ai.ts` already, so feel free to review, emulate and extend.
*   **Link:** [`intro-grounding-gemini.ipynb`](https://github.com/GoogleCloudPlatform/generative-ai/raw/refs/heads/main/gemini/grounding/intro-grounding-gemini.ipynb)
*   **Content (Relevant Snippet):**
    ```json
    {
  "cells": [
    {
      "cell_type": "code",
      "execution_count": null,
      "metadata": {
        "id": "ur8xi4C7S06n"
      },
      "outputs": [],
      "source": [
        "# Copyright 2024 Google LLC\n",
        "#\n",
        "# Licensed under the Apache License, Version 2.0 (the \"License\");\n",
        "# you may not use this file except in compliance with the License.\n",
        "# You may obtain a copy of the License at\n",
        "#\n",
        "#     https://www.apache.org/licenses/LICENSE-2.0\n",
        "#\n",
        "# Unless required by applicable law or agreed to in writing, software\n",
        "# distributed under the License is distributed on an \"AS IS\" BASIS,\n",
        "# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.\n",
        "# See the License for the specific language governing permissions and\n",
        "# limitations under the License."
      ]
    },
    {
      "cell_type": "markdown",
      "metadata": {
        "id": "JAPoU8Sm5E6e"
      },
      "source": [
        "# Intro to Grounding with Gemini in Vertex AI\n",
        "\n",
        "<table align=\"left\">\n",
        "  <td style=\"text-align: center\">\n",
        "    <a href=\"https://colab.research.google.com/github/GoogleCloudPlatform/generative-ai/blob/main/gemini/grounding/intro-grounding-gemini.ipynb\">\n",
        "      <img width=\"32px\" src=\"https://www.gstatic.com/pantheon/images/bigquery/welcome_page/colab-logo.svg\" alt=\"Google Colaboratory logo\"><br> Run in Colab\n",
        "    </a>\n",
        "  </td>\n",
        "  <td style=\"text-align: center\">\n",
        "    <a href=\"https://console.cloud.google.com/vertex-ai/colab/import/https:%2F%2Fraw.githubusercontent.com%2FGoogleCloudPlatform%2Fgenerative-ai%2Fmain%2Fgemini%2Fgrounding%2Fintro-grounding-gemini.ipynb\">\n",
        "      <img width=\"32px\" src=\"https://lh3.googleusercontent.com/JmcxdQi-qOpctIvWKgPtrzZdJJK-J3sWE1RsfjZNwshCFgE_9fULcNpuXYTilIR2hjwN\" alt=\"Google Cloud Colab Enterprise logo\"><br> Run in Colab Enterprise\n",
        "    </a>\n",
        "  </td>\n",
        "  <td style=\"text-align: center\">\n",
        "    <a href=\"https://github.com/GoogleCloudPlatform/generative-ai/blob/main/gemini/grounding/intro-grounding-gemini.ipynb\">\n",
        "      <img width=\"32px\" src=\"https://www.svgrepo.com/download/217753/github.svg\" alt=\"GitHub logo\"><br> View on GitHub\n",
        "    </a>\n",
        "  </td>\n",
        "  <td style=\"text-align: center\">\n",
        "    <a href=\"https://console.cloud.google.com/vertex-ai/workbench/deploy-notebook?download_url=https://raw.githubusercontent.com/GoogleCloudPlatform/generative-ai/main/gemini/grounding/intro-grounding-gemini.ipynb\">\n",
        "      <img src=\"https://www.gstatic.com/images/branding/gcpiconscolors/vertexai/v1/32px.svg\" alt=\"Vertex AI logo\"><br> Open in Vertex AI Workbench\n",
        "    </a>\n",
        "  </td>\n",
        "  <td style=\"text-align: center\">\n",
        "    <a href=\"https://goo.gle/4jeQyFS\">\n",
        "      <img width=\"32px\" src=\"https://cdn.qwiklabs.com/assets/gcp_cloud-e3a77215f0b8bfa9b3f611c0d2208c7e8708ed31.svg\" alt=\"Google Cloud logo\"><br> Open in  Cloud Skills Boost\n",
        "    </a>\n",
        "  </td>\n",
        "</table>\n",
        "\n",
        "<div style=\"clear: both;\"></div>\n",
        "\n",
        "<b>Share to:</b>\n",
        "\n",
        "<a href=\"https://www.linkedin.com/sharing/share-offsite/?url=https%3A//github.com/GoogleCloudPlatform/generative-ai/blob/main/gemini/grounding/intro-grounding-gemini.ipynb\" target=\"_blank\">\n",
        "  <img width=\"20px\" src=\"https://upload.wikimedia.org/wikipedia/commons/8/81/LinkedIn_icon.svg\" alt=\"LinkedIn logo\">\n",
        "</a>\n",
        "\n",
        "<a href=\"https://bsky.app/intent/compose?text=https%3A//github.com/GoogleCloudPlatform/generative-ai/blob/main/gemini/grounding/intro-grounding-gemini.ipynb\" target=\"_blank\">\n",
        "  <img width=\"20px\" src=\"https://upload.wikimedia.org/wikipedia/commons/7/7a/Bluesky_Logo.svg\" alt=\"Bluesky logo\">\n",
        "</a>\n",
        "\n",
        "<a href=\"https://twitter.com/intent/tweet?url=https%3A//github.com/GoogleCloudPlatform/generative-ai/blob/main/gemini/grounding/intro-grounding-gemini.ipynb\" target=\"_blank\">\n",
        "  <img width=\"20px\" src=\"https://upload.wikimedia.org/wikipedia/commons/5/5a/X_icon_2.svg\" alt=\"X logo\">\n",
        "</a>\n",
        "\n",
        "<a href=\"https://reddit.com/submit?url=https%3A//github.com/GoogleCloudPlatform/generative-ai/blob/main/gemini/grounding/intro-grounding-gemini.ipynb\" target=\"_blank\">\n",
        "  <img width=\"20px\" src=\"https://redditinc.com/hubfs/Reddit%20Inc/Brand/Reddit_Logo.png\" alt=\"Reddit logo\">\n",
        "</a>\n",
        "\n",
        "<a href=\"https://www.facebook.com/sharer/sharer.php?u=https%3A//github.com/GoogleCloudPlatform/generative-ai/blob/main/gemini/grounding/intro-grounding-gemini.ipynb\" target=\"_blank\">\n",
        "  <img width=\"20px\" src=\"https://upload.wikimedia.org/wikipedia/commons/5/51/Facebook_f_logo_%282019%29.svg\" alt=\"Facebook logo\">\n",
        "</a>            "
      ]
    },
    {
      "cell_type": "markdown",
      "metadata": {
        "id": "49e1e41cea0d"
      },
      "source": [
        "| Authors |\n",
        "| --- |\n",
        "| [Holt Skinner](https://github.com/holtskinner) |\n",
        "| [Kristopher Overholt](https://github.com/koverholt) |"
      ]
    },
    {
      "cell_type": "markdown",
      "metadata": {
        "id": "tvgnzT1CKxrO"
      },
      "source": [
        "## Overview\n",
        "\n",
        "**YouTube Video: Introduction to grounding with Gemini on Vertex AI**\n",
        "\n",
        "<a href=\"https://www.youtube.com/watch?v=Ph0g6dnsB4g&list=PLIivdWyY5sqJio2yeg1dlfILOUO2FoFRx\" target=\"_blank\">\n",
        "  <img src=\"https://img.youtube.com/vi/Ph0g6dnsB4g/maxresdefault.jpg\" alt=\"Introduction to grounding with Gemini on Vertex AI\" width=\"500\">\n",
        "</a>\n",
        "\n",
        "[Grounding in Vertex AI](https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/ground-gemini) lets you use generative text models to generate content grounded in your own documents and data. This capability lets the model access information at runtime that goes beyond its training data. By grounding model responses in Google Search results or data stores within [Vertex AI Search](https://cloud.google.com/generative-ai-app-builder/docs/enterprise-search-introduction), LLMs that are grounded in data can produce more accurate, up-to-date, and relevant responses.\n",
        "\n",
        "Grounding provides the following benefits:\n",
        "\n",
        "- Reduces model hallucinations (instances where the model generates content that isn't factual)\n",
        "- Anchors model responses to specific information, documents, and data sources\n",
        "- Enhances the trustworthiness, accuracy, and applicability of the generated content\n",
        "\n",
        "You can configure two different sources of grounding in Vertex AI:\n",
        "\n",
        "1. Google Search results for data that is publicly available and indexed.\n",
        "   - If you use this service in a production application, you will also need to [use a Google Search entry point](https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/grounding-search-entry-points).\n",
        "2. [Data stores in Vertex AI Search](https://cloud.google.com/generative-ai-app-builder/docs/create-datastore-ingest), which can include your own data in the form of website data, unstructured data, or structured data"
      ]
    },
    {
      "cell_type": "markdown",
      "metadata": {
        "id": "d975e698c9a4"
      },
      "source": [
        "### Objective\n",
        "\n",
        "In this tutorial, you learn how to:\n",
        "\n",
        "- Generate LLM text and chat model responses grounded in Google Search results\n",
        "- Compare the results of ungrounded LLM responses with grounded LLM responses\n",
        "- Create and use a data store in Vertex AI Search to ground responses in custom documents and data\n",
        "- Generate LLM text and chat model responses grounded in Vertex AI Search results\n",
        "\n",
        "This tutorial uses the following Google Cloud AI services and resources:\n",
        "\n",
        "- Vertex AI\n",
        "- Vertex AI Search\n",
        "\n",
        "The steps performed include:\n",
        "\n",
        "- Configuring the LLM and prompt for various examples\n",
        "- Sending example prompts to generative text and chat models in Vertex AI\n",
        "- Setting up a data store in Vertex AI Search with your own data\n",
        "- Sending example prompts with various levels of grounding (no grounding, web grounding, data store grounding)"
      ]
    },
    {
      "cell_type": "markdown",
      "metadata": {
        "id": "BF1j6f9HApxa"
      },
      "source": [
        "## Before you begin\n",
        "\n",
        "### Set up your Google Cloud project\n",
        "\n",
        "**The following steps are required, regardless of your notebook environment.**\n",
        "\n",
        "1. [Select or create a Google Cloud project](https://console.cloud.google.com/cloud-resource-manager). When you first create an account, you get a $300 free credit towards your compute/storage costs.\n",
        "1. [Make sure that billing is enabled for your project](https://cloud.google.com/billing/docs/how-to/modify-project).\n",
        "1. Enable the [Vertex AI and Vertex AI Search APIs](https://console.cloud.google.com/flows/enableapi?apiid=aiplatform.googleapis.com,discoveryengine.googleapis.com).\n",
        "1. If you are running this notebook locally, you need to install the [Cloud SDK](https://cloud.google.com/sdk)."
      ]
    },
    {
      "cell_type": "markdown",
      "metadata": {
        "id": "i7EUnXsZhAGF"
      },
      "source": [
        "### Install Google Gen AI SDK for Python\n",
        "\n",
        "Install the following packages required to execute this notebook."
      ]
    },
    {
      "cell_type": "code",
      "execution_count": null,
      "metadata": {
        "id": "2b4ef9b72d43"
      },
      "outputs": [],
      "source": [
        "%pip install --upgrade --quiet google-genai"
      ]
    },
    {
      "cell_type": "markdown",
      "metadata": {
        "id": "sBCra4QMA2wR"
      },
      "source": [
        "### Authenticate your Google Cloud account\n",
        "\n",
        "If you are running this notebook on Google Colab, you will need to authenticate your environment. To do this, run the new cell below. This step is not required if you are using Vertex AI Workbench."
      ]
    },
    {
      "cell_type": "code",
      "execution_count": null,
      "metadata": {
        "id": "603adbbf0532"
      },
      "outputs": [],
      "source": [
        "import sys\n",
        "\n",
        "if \"google.colab\" in sys.modules:\n",
        "    # Authenticate user to Google Cloud\n",
        "    from google.colab import auth\n",
        "\n",
        "    auth.authenticate_user()"
      ]
    },
    {
      "cell_type": "markdown",
      "metadata": {
        "id": "WReHDGG5g0XY"
      },
      "source": [
        "### Set Google Cloud project information and create client\n",
        "\n",
        "To get started using Vertex AI, you must have an existing Google Cloud project and [enable the Vertex AI API](https://console.cloud.google.com/flows/enableapi?apiid=aiplatform.googleapis.com).\n",
        "\n",
        "Learn more about [setting up a project and a development environment](https://cloud.google.com/vertex-ai/docs/start/cloud-environment).\n",
        "\n",
        "**If you don't know your project ID**, try the following:\n",
        "* Run `gcloud config list`.\n",
        "* Run `gcloud projects list`.\n",
        "* See the support page: [Locate the project ID](https://support.google.com/googleapi/answer/7014113)\n",
        "\n",
        "You can also change the `LOCATION` variable used by Vertex AI. Learn more about [Vertex AI regions](https://cloud.google.com/vertex-ai/docs/general/locations)."
      ]
    },
    {
      "cell_type": "code",
      "execution_count": null,
      "metadata": {
        "id": "oM1iC_MfAts1"
      },
      "outputs": [],
      "source": [
        "import os\n",
        "\n",
        "PROJECT_ID = \"[your-project-id]\"  # @param {type: \"string\"}\n",
        "if not PROJECT_ID or PROJECT_ID == \"[your-project-id]\":\n",
        "    PROJECT_ID = str(os.environ.get(\"GOOGLE_CLOUD_PROJECT\"))\n",
        "\n",
        "LOCATION = os.environ.get(\"GOOGLE_CLOUD_REGION\", \"us-central1\")\n",
        "\n",
        "from google import genai\n",
        "\n",
        "client = genai.Client(vertexai=True, project=PROJECT_ID, location=LOCATION)"
      ]
    },
    {
      "cell_type": "markdown",
      "metadata": {
        "id": "960505627ddf"
      },
      "source": [
        "### Import libraries"
      ]
    },
    {
      "cell_type": "code",
      "execution_count": null,
      "metadata": {
        "id": "PyQmSRbKA8r-"
      },
      "outputs": [],
      "source": [
        "from IPython.display import Markdown, display\n",
        "from google.genai.types import (\n",
        "    ApiKeyConfig,\n",
        "    AuthConfig,\n",
        "    EnterpriseWebSearch,\n",
        "    GenerateContentConfig,\n",
        "    GenerateContentResponse,\n",
        "    GoogleMaps,\n",
        "    GoogleSearch,\n",
        "    LatLng,\n",
        "    Part,\n",
        "    Retrieval,\n",
        "    RetrievalConfig,\n",
        "    Tool,\n",
        "    ToolConfig,\n",
        "    VertexAISearch,\n",
        ")"
      ]
    },
    {
      "cell_type": "markdown",
      "metadata": {
        "id": "4e569c5d4a49"
      },
      "source": [
        "### Helper functions"
      ]
    },
    {
      "cell_type": "code",
      "execution_count": null,
      "metadata": {
        "id": "307f36dbd36c"
      },
      "outputs": [],
      "source": [
        "def print_grounding_data(response: GenerateContentResponse) -> None:\n",
        "    \"\"\"Prints Gemini response with grounding citations in Markdown format.\"\"\"\n",
        "    if not (response.candidates and response.candidates[0].grounding_metadata):\n",
        "        print(\"Response does not contain grounding metadata.\")\n",
        "        display(Markdown(response.text))\n",
        "        return\n",
        "\n",
        "    grounding_metadata = response.candidates[0].grounding_metadata\n",
        "    markdown_parts = []\n",
        "\n",
        "    # Citation indexes are in bytes\n",
        "    ENCODING = \"utf-8\"\n",
        "    text_bytes = response.text.encode(ENCODING)\n",
        "    last_byte_index = 0\n",
        "\n",
        "    for support in grounding_metadata.grounding_supports:\n",
        "        markdown_parts.append(\n",
        "            text_bytes[last_byte_index : support.segment.end_index].decode(ENCODING)\n",
        "        )\n",
        "\n",
        "        # Generate and append citation footnotes (e.g., \"[1][2]\")\n",
        "        footnotes = \"\".join([f\"[{i + 1}]\" for i in support.grounding_chunk_indices])\n",
        "        markdown_parts.append(f\" {footnotes}\")\n",
        "\n",
        "        # Update index for the next segment\n",
        "        last_byte_index = support.segment.end_index\n",
        "\n",
        "    # Append any remaining text after the last citation\n",
        "    if last_byte_index < len(text_bytes):\n",
        "        markdown_parts.append(text_bytes[last_byte_index:].decode(ENCODING))\n",
        "\n",
        "    markdown_parts.append(\"\\n\\n----\\n## Grounding Sources\\n\")\n",
        "\n",
        "    # Build Grounding Sources Section\n",
        "    markdown_parts.append(\"### Grounding Chunks\\n\")\n",
        "    for i, chunk in enumerate(grounding_metadata.grounding_chunks, start=1):\n",
        "        context = chunk.web or chunk.retrieved_context\n",
        "        if not context:\n",
        "            continue\n",
        "\n",
        "        uri = context.uri\n",
        "        title = context.title or \"Source\"\n",
        "\n",
        "        # Convert GCS URIs to public HTTPS URLs\n",
        "        if uri and uri.startswith(\"gs://\"):\n",
        "            uri = uri.replace(\"gs://\", \"https://storage.googleapis.com/\", 1).replace(\n",
        "                \" \", \"%20\"\n",
        "            )\n",
        "        markdown_parts.append(f\"{i}. [{title}]({uri})\\n\")\n",
        "\n",
        "    # Add Search/Retrieval Queries\n",
        "    if grounding_metadata.web_search_queries:\n",
        "        markdown_parts.append(\n",
        "            f\"\\n**Web Search Queries:** {grounding_metadata.web_search_queries}\\n\"\n",
        "        )\n",
        "        if grounding_metadata.search_entry_point:\n",
        "            markdown_parts.append(\n",
        "                f\"\\n**Search Entry Point:**\\n{grounding_metadata.search_entry_point.rendered_content}\\n\"\n",
        "            )\n",
        "    elif grounding_metadata.retrieval_queries:\n",
        "        markdown_parts.append(\n",
        "            f\"\\n**Retrieval Queries:** {grounding_metadata.retrieval_queries}\\n\"\n",
        "        )\n",
        "\n",
        "    display(Markdown(\"\".join(markdown_parts)))"
      ]
    },
    {
      "cell_type": "markdown",
      "metadata": {
        "id": "55cf2dd17690"
      },
      "source": [
        "Initialize the Gemini model from Vertex AI:"
      ]
    },
    {
      "cell_type": "code",
      "execution_count": null,
      "metadata": {
        "id": "652a8969dd5a"
      },
      "outputs": [],
      "source": [
        "MODEL_ID = \"gemini-2.0-flash\"  # @param {type: \"string\"}"
      ]
    },
    {
      "cell_type": "markdown",
      "metadata": {
        "id": "e336da7161af"
      },
      "source": [
        "## Example: Grounding with Google Search results\n",
        "\n",
        "In this example, you'll compare LLM responses with no grounding with responses that are grounded in the results of a Google Search. You'll ask a question about a the most recent solar eclipse."
      ]
    },
    {
      "cell_type": "code",
      "execution_count": null,
      "metadata": {
        "id": "6a28ca4abb52"
      },
      "outputs": [],
      "source": [
        "PROMPT = \"When is the next solar eclipse in the US?\""
      ]
    },
    {
      "cell_type": "markdown",
      "metadata": {
        "id": "25955ce5d263"
      },
      "source": [
        "### Text generation without grounding\n",
        "\n",
        "Make a prediction request to the LLM with no grounding:"
      ]
    },
    {
      "cell_type": "code",
      "execution_count": null,
      "metadata": {
        "id": "a2e348ff93e6"
      },
      "outputs": [],
      "source": [
        "response = client.models.generate_content(\n",
        "    model=MODEL_ID,\n",
        "    contents=PROMPT,\n",
        ")\n",
        "\n",
        "display(Markdown(response.text))"
      ]
    },
    {
      "cell_type": "markdown",
      "metadata": {
        "id": "5d7cb7cceb99"
      },
      "source": [
        "### Text generation grounded in Google Search results\n",
        "\n",
        "You can add the `tools` keyword argument with a `Tool` including `GoogleSearch` to instruct Gemini to first perform a Google Search with the prompt, then construct an answer based on the web search results.\n",
        "\n",
        "The search queries and [Search Entry Point](https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/grounding-search-entry-points) are available for each `Candidate` in the response."
      ]
    },
    {
      "cell_type": "code",
      "execution_count": null,
      "metadata": {
        "id": "1d9fb83b0ab9"
      },
      "outputs": [],
      "source": [
        "google_search_tool = Tool(google_search=GoogleSearch())\n",
        "\n",
        "response = client.models.generate_content(\n",
        "    model=MODEL_ID,\n",
        "    contents=PROMPT,\n",
        "    config=GenerateContentConfig(tools=[google_search_tool]),\n",
        ")\n",
        "\n",
        "print_grounding_data(response)"
      ]
    },
    {
      "cell_type": "markdown",
      "metadata": {
        "id": "6d3920bb2ac0"
      },
      "source": [
        "Note that the response without grounding only has limited information from the LLM about solar eclipses. Whereas the response that was grounded in web search results contains the most up to date information from web search results that are returned as part of the LLM with grounding request."
      ]
    },
    {
      "cell_type": "markdown",
      "metadata": {
        "id": "59c98ab0f5fb"
      },
      "source": [
        "### Text generation with multimodal input grounded in Google Search results\n",
        "\n",
        "Gemini can also generate grounded responses with multimodal input. Let's try with this image of the Eiffel Tower.\n",
        "\n",
        "![Paris](https://storage.googleapis.com/github-repo/generative-ai/gemini/grounding/paris.jpg)"
      ]
    },
    {
      "cell_type": "code",
      "execution_count": null,
      "metadata": {
        "id": "5ebdda19afad"
      },
      "outputs": [],
      "source": [
        "PROMPT = \"What is the current temperature at this location?\"\n",
        "\n",
        "response = client.models.generate_content(\n",
        "    model=MODEL_ID,\n",
        "    contents=[\n",
        "        Part.from_uri(\n",
        "            file_uri=\"gs://github-repo/generative-ai/gemini/grounding/paris.jpg\",\n",
        "            mime_type=\"image/jpeg\",\n",
        "        ),\n",
        "        PROMPT,\n",
        "    ],\n",
        "    config=GenerateContentConfig(\n",
        "        tools=[google_search_tool],\n",
        "    ),\n",
        ")\n",
        "\n",
        "print_grounding_data(response)"
      ]
    },
    {
      "cell_type": "markdown",
      "metadata": {
        "id": "a29c93ef3f34"
      },
      "source": [
        "## Example: Grounding with Enterprise Web Search\n",
        "\n",
        "Grounding with Google Search uses Google Search to perform searches across the web. As part of this offering, Google Search might perform logging of customer queries (see [section 19.k of Google Cloud Service Specific Terms](https://cloud.google.com/terms/service-terms)). This often doesn't meet the compliance requirements of customers in highly regulated industries like Finance or Healthcare.\n",
        "\n",
        "Enterprise Web Search meets these requirements. When a customer uses Enterprise Web Search to ground on the web, this is done without logging of customer data and with full support for VPC SC and ML processing in-region. Enterprise Web Search Grounding is available in an US and EU multi-region.\n",
        "\n",
        "Request and response format for Enterprise Web Search Grounding are very similar to Grounding with Google Search.\n",
        "\n",
        "### Gemini model compatibility\n",
        "\n",
        "Enterprise Web Search is compatible with all Gemini 2.0 models which support grounding. Gemini 2.0 Flash supports multimodal input (e.g. images, documents, videos). "
      ]
    },
    {
      "cell_type": "code",
      "execution_count": null,
      "metadata": {
        "id": "b2587492ab3f"
      },
      "outputs": [],
      "source": [
        "PROMPT = \"Who won the 2025 UEFA European Championship?\"\n",
        "\n",
        "enterprise_web_search_tool = Tool(enterprise_web_search=EnterpriseWebSearch())\n",
        "\n",
        "response = client.models.generate_content(\n",
        "    model=MODEL_ID,\n",
        "    contents=PROMPT,\n",
        "    config=GenerateContentConfig(tools=[enterprise_web_search_tool]),\n",
        ")\n",
        "\n",
        "print_grounding_data(response)"
      ]
    },
    {
      "cell_type": "markdown",
      "metadata": {
        "id": "6708e03a1d7b"
      },
      "source": [
        "## Example: Grounding with Google Maps\n",
        "\n",
        "You can also use Google Maps data for grounding with Gemini. See the [announcement blog](https://blog.google/products/earth/grounding-google-maps-generative-ai/) for more information.\n",
        "\n",
        "**NOTE:** This feature is allowlist-only, refer to the [documentation](https://cloud.google.com/vertex-ai/generative-ai/docs/grounding/grounding-with-google-maps) for how to request access."
      ]
    },
    {
      "cell_type": "markdown",
      "metadata": {
        "id": "0a9ce21ca573"
      },
      "source": [
        "First, you will need to create a [Google Maps API Key](https://cloud.google.com/vertex-ai/generative-ai/docs/grounding/grounding-with-google-maps#access-to-google-maps)."
      ]
    },
    {
      "cell_type": "code",
      "execution_count": null,
      "metadata": {
        "id": "53102c85aa24"
      },
      "outputs": [],
      "source": [
        "GOOGLE_MAPS_API_KEY = \"[your-google-maps-api-key]\"  # @param {type: \"string\"}"
      ]
    },
    {
      "cell_type": "code",
      "execution_count": null,
      "metadata": {
        "id": "ebfa54b6b14e"
      },
      "outputs": [],
      "source": [
        "google_maps_tool = Tool(\n",
        "    google_maps=GoogleMaps(\n",
        "        auth_config=AuthConfig(\n",
        "            api_key_config=ApiKeyConfig(\n",
        "                api_key_string=GOOGLE_MAPS_API_KEY,\n",
        "            )\n",
        "        )\n",
        "    )\n",
        ")\n",
        "PROMPT = \"Recommend some good vegetarian food in Las Vegas.\"\n",
        "\n",
        "response = client.models.generate_content(\n",
        "    model=MODEL_ID,\n",
        "    contents=[\n",
        "        PROMPT,\n",
        "    ],\n",
        "    config=GenerateContentConfig(\n",
        "        system_instruction=\"You are a helpful assistant that provides information about locations. You have access to map data and can answer questions about distances, directions, and points of interest.\",\n",
        "        tools=[google_maps_tool],\n",
        "        # Optional: Set Latitude and Longitude for the Google Maps tool\n",
        "        tool_config=ToolConfig(\n",
        "            retrieval_config=RetrievalConfig(\n",
        "                lat_lng=LatLng(latitude=36.1699, longitude=-115.1398)\n",
        "            ),\n",
        "        ),\n",
        "    ),\n",
        ")\n",
        "\n",
        "print_grounding_data(response)"
      ]
    },
    {
      "cell_type": "markdown",
      "metadata": {
        "id": "77f0800f8762"
      },
      "source": [
        "## Example: Grounding with custom documents and data\n",
        "\n",
        "In this example, you'll compare LLM responses with no grounding with responses that are grounded in the [results of a search app in Vertex AI Search](https://cloud.google.com/generative-ai-app-builder/docs/create-datastore-ingest).\n",
        "\n",
        "The data store will contain internal documents from a fictional bank, Cymbal Bank. These documents aren't available on the public internet, so the Gemini model won't have any information about them by default."
      ]
    },
    {
      "cell_type": "markdown",
      "metadata": {
        "id": "1b308548c68b"
      },
      "source": [
        "### Creating a data store in Vertex AI Search\n",
        "\n",
        "In this example, you'll use a Google Cloud Storage bucket with a few sample internal documents for our bank. There's some docs about booking business travel, strategic plan for this Fiscal Year and HR docs describing the different jobs available in the company.\n",
        "\n",
        "Follow the tutorial steps in the Vertex AI Search documentation to:\n",
        "\n",
        "1. [Create a data store with unstructured data](https://cloud.google.com/generative-ai-app-builder/docs/try-enterprise-search#unstructured-data) that loads in documents from the GCS folder `gs://cloud-samples-data/gen-app-builder/search/cymbal-bank-employee`.\n",
        "2. [Create a search app](https://cloud.google.com/generative-ai-app-builder/docs/try-enterprise-search#create_a_search_app) that is attached to that data store. You should also enable the **Enterprise edition features** so that you can search indexed records within the data store.\n",
        "\n",
        "**Note:** The data store must be in the same project that you are using for Gemini.\n",
        "\n",
        "You can also follow this notebook to do it with code. [Create a Vertex AI Search Datastore and App](https://github.com/GoogleCloudPlatform/generative-ai/blob/main/search/create_datastore_and_search.ipynb)\n",
        "\n",
        "Once you've created a data store, obtain the App ID and input it below.\n",
        "\n",
        "Note: You will need to wait for data ingestion to finish before using a data store with grounding. For more information, see [create a data store](https://cloud.google.com/generative-ai-app-builder/docs/create-data-store-es)."
      ]
    },
    {
      "cell_type": "code",
      "execution_count": null,
      "metadata": {
        "id": "fcd767476241"
      },
      "outputs": [],
      "source": [
        "VERTEX_AI_SEARCH_PROJECT_ID = PROJECT_ID  # @param {type: \"string\"}\n",
        "VERTEX_AI_SEARCH_REGION = \"global\"  # @param {type: \"string\"}\n",
        "# Replace this with your App (Engine) ID from Vertex AI Search\n",
        "VERTEX_AI_SEARCH_APP_ID = \"cymbal-bank-onboarding\"  # @param {type: \"string\"}\n",
        "\n",
        "VERTEX_AI_SEARCH_ENGINE_NAME = f\"projects/{VERTEX_AI_SEARCH_PROJECT_ID}/locations/{VERTEX_AI_SEARCH_REGION}/collections/default_collection/engines/{VERTEX_AI_SEARCH_APP_ID}\""
      ]
    },
    {
      "cell_type": "markdown",
      "metadata": {
        "id": "ccc156676e0a"
      },
      "source": [
        "Now you can ask a question about the company culture:"
      ]
    },
    {
      "cell_type": "code",
      "execution_count": null,
      "metadata": {
        "id": "9c1e1b1743bd"
      },
      "outputs": [],
      "source": [
        "PROMPT = \"What is the company culture like?\""
      ]
    },
    {
      "cell_type": "markdown",
      "metadata": {
        "id": "f365681544bb"
      },
      "source": [
        "### Text generation without grounding\n",
        "\n",
        "Make a prediction request to the LLM with no grounding:"
      ]
    },
    {
      "cell_type": "code",
      "execution_count": null,
      "metadata": {
        "id": "299818ae71e9"
      },
      "outputs": [],
      "source": [
        "response = client.models.generate_content(\n",
        "    model=MODEL_ID,\n",
        "    contents=PROMPT,\n",
        ")\n",
        "\n",
        "display(Markdown(response.text))"
      ]
    },
    {
      "cell_type": "markdown",
      "metadata": {
        "id": "073f2ec42ff6"
      },
      "source": [
        "### Text generation grounded in Vertex AI Search results\n",
        "\n",
        "Now we can add the `tools` keyword arg with a grounding tool of `grounding.VertexAISearch()` to instruct the LLM to first perform a search within your search app, then construct an answer based on the relevant documents:"
      ]
    },
    {
      "cell_type": "code",
      "execution_count": null,
      "metadata": {
        "id": "d4c5d53a37b4"
      },
      "outputs": [],
      "source": [
        "vertex_ai_search_tool = Tool(\n",
        "    retrieval=Retrieval(\n",
        "        vertex_ai_search=VertexAISearch(engine=VERTEX_AI_SEARCH_ENGINE_NAME)\n",
        "    )\n",
        ")\n",
        "\n",
        "response = client.models.generate_content(\n",
        "    model=MODEL_ID,\n",
        "    contents=\"What is the company culture like?\",\n",
        "    config=GenerateContentConfig(tools=[vertex_ai_search_tool]),\n",
        ")\n",
        "\n",
        "print_grounding_data(response)"
      ]
    },
    {
      "cell_type": "markdown",
      "metadata": {
        "id": "e3f985c704cd"
      },
      "source": [
        "Note that the response without grounding doesn't have any context about what company we are asking about. Whereas the response that was grounded in Vertex AI Search results contains information from the documents provided, along with citations of the information.\n",
        "\n",
        "<div class=\"alert alert-block alert-warning\">\n",
        "<b>⚠️ Important notes:</b><br>\n",
        "<br>\n",
        "<b>If you get an error when running the previous cell:</b><br>\n",
        "&nbsp;&nbsp;&nbsp;&nbsp;In order for this sample notebook to work with data store in Vertex AI Search,<br>\n",
        "&nbsp;&nbsp;&nbsp;&nbsp;you'll need to create a <a href=\"https://cloud.google.com/generative-ai-app-builder/docs/try-enterprise-search#create_a_data_store\">data store</a> <b>and</b> a <a href=\"https://cloud.google.com/generative-ai-app-builder/docs/try-enterprise-search#create_a_search_app\">search app</a> associated with it in Vertex AI Search.<br>\n",
        "&nbsp;&nbsp;&nbsp;&nbsp;If you only create a data store, the previous request will return errors when making queries against the data store.\n",
        "<br><br>\n",
        "<b>If you get an empty response when running the previous cell:</b><br>\n",
        "&nbsp;&nbsp;&nbsp;&nbsp;You will need to wait for data ingestion to finish before using a data store with grounding.<br>\n",
        "&nbsp;&nbsp;&nbsp;&nbsp;For more information, see <a href=\"https://cloud.google.com/generative-ai-app-builder/docs/create-data-store-es\">create a data store</a>.\n",
        "</div>\n",
        "</div>"
      ]
    },
    {
      "cell_type": "markdown",
      "metadata": {
        "id": "54562717e2a4"
      },
      "source": [
        "## Example: Grounded chat responses\n",
        "\n",
        "You can also use grounding when using chat conversations in Vertex AI. In this example, you'll compare LLM responses with no grounding with responses that are grounded in the results of a Google Search and a data store in Vertex AI Search."
      ]
    },
    {
      "cell_type": "code",
      "execution_count": null,
      "metadata": {
        "id": "490cf1ed3399"
      },
      "outputs": [],
      "source": [
        "PROMPT = \"What are managed datasets in Vertex AI?\"\n",
        "PROMPT_FOLLOWUP = \"What types of data can I use?\""
      ]
    },
    {
      "cell_type": "markdown",
      "metadata": {
        "id": "b59783e4f1ce"
      },
      "source": [
        "### Chat session grounded in Google Search results\n",
        "\n",
        "Now you can add the `tools` keyword arg with a Tool of `GoogleSearch` to instruct the chat model to first perform a Google Search with the prompt, then construct an answer based on the web search results:"
      ]
    },
    {
      "cell_type": "code",
      "execution_count": null,
      "metadata": {
        "id": "58edb2bd860f"
      },
      "outputs": [],
      "source": [
        "chat = client.chats.create(\n",
        "    model=MODEL_ID,\n",
        "    config=GenerateContentConfig(tools=[Tool(google_search=GoogleSearch())]),\n",
        ")\n",
        "\n",
        "display(Markdown(\"## Prompt\"))\n",
        "display(Markdown(f\"> {PROMPT}\"))\n",
        "response = chat.send_message(PROMPT)\n",
        "print_grounding_data(response)\n",
        "\n",
        "display(Markdown(\"---\\n\"))\n",
        "\n",
        "display(Markdown(\"## Follow-up Prompt\"))\n",
        "display(Markdown(f\"> {PROMPT_FOLLOWUP}\"))\n",
        "response = chat.send_message(PROMPT_FOLLOWUP)\n",
        "print_grounding_data(response)"
      ]
    },
    {
      "cell_type": "markdown",
      "metadata": {
        "id": "87be7f661f14"
      },
      "source": [
        "### Chat session grounded in Vertex AI Search results\n",
        "\n",
        "Now we can add the `tools` keyword arg with a grounding tool of `VertexAISearch` to instruct the chat session to first perform a search within your custom search app, then construct an answer based on the relevant documents:"
      ]
    },
    {
      "cell_type": "code",
      "execution_count": null,
      "metadata": {
        "id": "8fdad0c3f1f3"
      },
      "outputs": [],
      "source": [
        "PROMPT = \"How do I book business travel?\"\n",
        "PROMPT_FOLLOWUP = \"Give me more details.\""
      ]
    },
    {
      "cell_type": "code",
      "execution_count": null,
      "metadata": {
        "id": "1a824202a8f0"
      },
      "outputs": [],
      "source": [
        "chat = client.chats.create(\n",
        "    model=MODEL_ID,\n",
        "    config=GenerateContentConfig(\n",
        "        tools=[\n",
        "            Tool(\n",
        "                retrieval=Retrieval(\n",
        "                    vertex_ai_search=VertexAISearch(engine=VERTEX_AI_SEARCH_ENGINE_NAME)\n",
        "                )\n",
        "            )\n",
        "        ]\n",
        "    ),\n",
        ")\n",
        "\n",
        "display(Markdown(\"## Prompt\"))\n",
        "display(Markdown(f\"> {PROMPT}\"))\n",
        "response = chat.send_message(PROMPT)\n",
        "print_grounding_data(response)\n",
        "\n",
        "display(Markdown(\"---\\n\"))\n",
        "\n",
        "display(Markdown(\"## Follow-up Prompt\"))\n",
        "display(Markdown(f\"> {PROMPT_FOLLOWUP}\"))\n",
        "response = chat.send_message(PROMPT_FOLLOWUP)\n",
        "print_grounding_data(response)"
      ]
    },
    {
      "cell_type": "markdown",
      "metadata": {
        "id": "TpV-iwP9qw9c"
      },
      "source": [
        "## Cleaning up\n",
        "\n",
        "To avoid incurring charges to your Google Cloud account for the resources used in this notebook, follow these steps:\n",
        "\n",
        "1. To avoid unnecessary Google Cloud charges, use the [Google Cloud console](https://console.cloud.google.com/) to delete your project if you do not need it. Learn more in the Google Cloud documentation for [managing and deleting your project](https://cloud.google.com/resource-manager/docs/creating-managing-projects).\n",
        "1. If you used an existing Google Cloud project, delete the resources you created to avoid incurring charges to your account. For more information, refer to the documentation to [Delete data from a data store in Vertex AI Search](https://cloud.google.com/generative-ai-app-builder/docs/delete-datastores), then delete your data store.\n",
        "2. Disable the [Vertex AI Search API](https://console.cloud.google.com/apis/api/discoveryengine.googleapis.com) and [Vertex AI API](https://console.cloud.google.com/apis/api/aiplatform.googleapis.com) in the Google Cloud Console."
      ]
    }
  ],
  "metadata": {
    "colab": {
      "collapsed_sections": [],
      "name": "intro-grounding-gemini.ipynb",
      "toc_visible": true
    },
    "kernelspec": {
      "display_name": "Python 3",
      "name": "python3"
    }
  },
  "nbformat": 4,
  "nbformat_minor": 0
}
    ```
    *The grounding metadata contains `web_search_queries` and `grounding_attributions` which link back to the source URIs and content segments used to generate the response.*

#### **URL Context**
*   **Note:** always enable the tool for gemini
*   **Link:** [`generate_content_with_url_context.ts`](https://github.com/googleapis/js-genai/raw/refs/heads/main/sdk-samples/generate_content_with_url_context.ts)
*   **Content:**
    ```typescript
    /**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {GoogleGenAI} from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_GENAI_USE_VERTEXAI = process.env.GOOGLE_GENAI_USE_VERTEXAI;

async function generateContentFromMLDev() {
  const ai = new GoogleGenAI({vertexai: false, apiKey: GEMINI_API_KEY});
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-preview-04-17',
    contents: 'What are the top headlines on https://news.google.com',
    config: {
      tools: [
        {
          urlContext: {},
        },
      ],
    },
  });
  console.debug(response.text);
  if (response.candidates) {
    console.debug(response.candidates[0].urlContextMetadata);
  }
}

async function generateContentFromVertexAI() {
  console.log("urlContext isn't supported on Vertex AI");
}

async function main() {
  if (GOOGLE_GENAI_USE_VERTEXAI) {
    await generateContentFromVertexAI().catch((e) =>
      console.error('got error', e),
    );
  } else {
    await generateContentFromMLDev().catch((e) =>
      console.error('got error', e),
    );
  }
}

main();
    ```

### **Note: Structured JSON/JSON Mode**
*   **Link:** [`generate_content_with_response_schema.ts`](https://github.com/googleapis/js-genai/raw/refs/heads/main/sdk-samples/generate_content_with_response_schema.ts)
*   **Content:**
    ```typescript
    /**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {GoogleGenAI, Type} from '@google/genai';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION;
const GOOGLE_GENAI_USE_VERTEXAI = process.env.GOOGLE_GENAI_USE_VERTEXAI;

async function generateContentFromMLDev() {
  const ai = new GoogleGenAI({vertexai: false, apiKey: GOOGLE_API_KEY});

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: 'List 3 popular cookie recipes.',
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            'recipeName': {
              type: Type.STRING,
              description: 'Name of the recipe',
              nullable: false,
            },
          },
          required: ['recipeName'],
        },
      },
    },
  });

  console.debug(response.text);
}

async function generateContentFromVertexAI() {
  const ai = new GoogleGenAI({
    vertexai: true,
    project: GOOGLE_CLOUD_PROJECT,
    location: GOOGLE_CLOUD_LOCATION,
  });

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: 'List 3 popular cookie recipes.',
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            'recipeName': {
              type: Type.STRING,
              description: 'Name of the recipe',
              nullable: false,
            },
          },
          required: ['recipeName'],
        },
      },
    },
  });

  console.debug(response.text);
}

async function main() {
  if (GOOGLE_GENAI_USE_VERTEXAI) {
    await generateContentFromVertexAI().catch((e) =>
      console.error('got error', e),
    );
  } else {
    await generateContentFromMLDev().catch((e) =>
      console.error('got error', e),
    );
  }
}

main();
    ```

### **Note: Image Generation**
*   **Link:** [`generate_image.ts`](https://github.com/googleapis/js-genai/raw/refs/heads/main/sdk-samples/generate_image.ts)
*   **Content:**
    ```typescript
    /**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {GoogleGenAI} from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION;
const GOOGLE_GENAI_USE_VERTEXAI = process.env.GOOGLE_GENAI_USE_VERTEXAI;

async function generateImagesFromMLDev() {
  const ai = new GoogleGenAI({vertexai: false, apiKey: GEMINI_API_KEY});
  const response = await ai.models.generateImages({
    model: 'imagen-3.0-generate-002',
    prompt: 'Robot holding a red skateboard',
    config: {
      numberOfImages: 1,
      includeRaiReason: true,
    },
  });

  console.debug(response?.generatedImages?.[0]?.image?.imageBytes);
}

async function generateImagesFromVertexAI() {
  const ai = new GoogleGenAI({
    vertexai: true,
    project: GOOGLE_CLOUD_PROJECT,
    location: GOOGLE_CLOUD_LOCATION,
  });
  const response = await ai.models.generateImages({
    model: 'imagen-3.0-generate-002',
    prompt: 'Robot holding a red skateboard',
    config: {
      numberOfImages: 1,
      includeRaiReason: true,
    },
  });

  console.debug(response?.generatedImages?.[0]?.image?.imageBytes);
}

async function main() {
  if (GOOGLE_GENAI_USE_VERTEXAI) {
    await generateImagesFromVertexAI().catch((e) =>
      console.error('got error', e),
    );
  } else {
    await generateImagesFromMLDev().catch((e) => console.error('got error', e));
  }
}

main();
    ```

### **Note: Video Generation**
*   **Link:** [`generate_video.ts`](https://github.com/googleapis/js-genai/raw/refs/heads/main/sdk-samples/generate_video.ts)
*   **Content:**
    ```typescript
    /**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {GoogleGenAI} from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION;
const GOOGLE_GENAI_USE_VERTEXAI = process.env.GOOGLE_GENAI_USE_VERTEXAI;

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateContentFromMLDev() {
  const ai = new GoogleGenAI({vertexai: false, apiKey: GEMINI_API_KEY});
  let operation = await ai.models.generateVideos({
    model: 'veo-2.0-generate-001',
    prompt: 'Man with a dog',
    config: {
      numberOfVideos: 1,
    },
  });

  while (!operation.done) {
    console.log('Waiting for completion');
    await delay(1000);
    operation = await ai.operations.getVideosOperation({operation: operation});
  }

  const videos = operation.response?.generatedVideos;
  if (videos === undefined || videos.length === 0) {
    throw new Error('No videos generated');
  }

  videos.forEach((video, i) => {
    ai.files.download({
      file: video,
      downloadPath: `video${i}.mp4`,
    });
    console.log('Downloaded video', `video${i}.mp4`);
  });
}

async function generateContentFromVertexAI() {
  const ai = new GoogleGenAI({
    vertexai: true,
    project: GOOGLE_CLOUD_PROJECT,
    location: GOOGLE_CLOUD_LOCATION,
  });
  let operation = await ai.models.generateVideos({
    model: 'veo-2.0-generate-001',
    prompt: 'Man with a dog',
  });

  while (!operation.done) {
    console.log('Waiting for completion');
    await delay(1000);
    operation = await ai.operations.getVideosOperation({operation: operation});
  }

  const videos = operation.response?.generatedVideos;
  if (videos === undefined || videos.length === 0) {
    throw new Error('No videos generated');
  }

  videos.forEach((video, i) => {
    ai.files.download({
      file: video,
      downloadPath: `video${i}.mp4`,
    });
    console.log('Downloaded video', `video${i}.mp4`);
  });
}

async function main() {
  if (GOOGLE_GENAI_USE_VERTEXAI) {
    await generateContentFromVertexAI().catch((e) =>
      console.error('got error', e),
    );
  } else {
    await generateContentFromMLDev().catch((e) =>
      console.error('got error', e),
    );
  }
}

main();
    ```

### **Note: Live Chat**
*   **Note:** always use URL context/web access when possible
*   **Link (Live Chat):** [`live_client_content.ts`](https://github.com/googleapis/js-genai/raw/refs/heads/main/sdk-samples/live_client_content.ts)
*   **Content:**
    ```typescript
    /**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  AuthToken,
  GoogleGenAI,
  LiveServerMessage,
  Modality,
} from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION;
const GOOGLE_GENAI_USE_VERTEXAI = process.env.GOOGLE_GENAI_USE_VERTEXAI;
const GOOGLE_GENAI_MLDEV_USE_EPHEMERAL =
  process.env.GOOGLE_GENAI_MLDEV_USE_EPHEMERAL;

class AsyncQueue<T> {
  private queue: T[] = [];
  private waiting: ((value: T) => void)[] = [];

  /**
   * Adds an item to the queue.
   * If there's a waiting consumer, it resolves immediately.
   * @param item The item to add to the queue.
   */
  put(item: T): void {
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift();
      if (resolve) {
        resolve(item);
      }
    } else {
      this.queue.push(item);
    }
  }

  /**
   * Gets the next item from the queue.
   * If the queue is empty, it waits for an item to be added.
   * @return A Promise that resolves with the next item.
   */
  get(): Promise<T> {
    return new Promise<T>((resolve) => {
      if (this.queue.length > 0) {
        resolve(this.queue.shift()!);
      } else {
        this.waiting.push(resolve);
      }
    });
  }

  /**
   * Returns the number of items in the queue.
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Returns true if the queue is empty.
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Clears the queue.
   */
  clear(): void {
    this.queue = [];
    this.waiting = [];
  }
}

async function live(client: GoogleGenAI, model: string) {
  const responseQueue = new AsyncQueue<LiveServerMessage>();

  async function handleTurn(): Promise<LiveServerMessage[]> {
    const turn: LiveServerMessage[] = [];
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const message = await responseQueue.get();
      const text = message.serverContent?.modelTurn?.parts?.[0]?.text;
      const inlineData =
        message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;

      if (text) {
        console.log(`Received text: ${text}`);
      }
      if (inlineData) {
        console.log(`Received inline data: ${inlineData}`);
      }

      turn.push(message);
      if (message.serverContent?.turnComplete) {
        return turn;
      }
    }
  }

  const session = await client.live.connect({
    model: model,
    callbacks: {
      onopen: () => {
        console.debug('Opened');
      },
      onmessage: (message: LiveServerMessage) => {
        responseQueue.put(message);
      },
      onerror: (e: ErrorEvent) => {
        console.debug('Error:', e.message);
      },
      onclose: (e: CloseEvent) => {
        console.debug('Close:', e.reason);
        responseQueue.clear();
      },
    },
    config: {responseModalities: [Modality.TEXT]},
  });

  const simple = 'Hello world';
  console.log('-'.repeat(80));
  console.log(`Sent: ${simple}`);
  session.sendClientContent({turns: simple});

  await handleTurn();

  const turns = [
    'This image is just black, can you see it?',
    {
      inlineData: {
        // 2x2 black PNG, base64 encoded.
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAC0lEQVR4nGNgQAYAAA4AAamRc7EAAAAASUVORK5CYII=',
        mimeType: 'image/png',
      },
    },
  ];
  console.log('-'.repeat(80));
  console.log(`Sent: ${turns}`);
  session.sendClientContent({turns: turns});

  await handleTurn();

  session.close();
}

async function main() {
  if (GOOGLE_GENAI_USE_VERTEXAI) {
    const client = new GoogleGenAI({
      vertexai: true,
      project: GOOGLE_CLOUD_PROJECT,
      location: GOOGLE_CLOUD_LOCATION,
    });
    const model = 'gemini-2.0-flash-live-preview-04-09';
    await live(client, model).catch((e) => console.error('got error', e));
    return;
  }

  const model = 'gemini-2.0-flash-live-001';
  let client = new GoogleGenAI({
    vertexai: false,
    apiKey: GEMINI_API_KEY,
  });

  if (GOOGLE_GENAI_MLDEV_USE_EPHEMERAL) {
    // Create the ephemeral token, normally you'd do this on your server
    // using your API key.
    const token: AuthToken = await client.authTokens.create({
      config: {
        uses: 1, // The default
        liveConnectConstraints: {
          model: model,
          config: {
            responseModalities: [Modality.TEXT],
          },
        },
        // Ephemeral tokens only work on v1alpha for now.
        httpOptions: {apiVersion: 'v1alpha'},
      },
    });
    console.log('Token:', JSON.stringify(token));

    // Use the auth token to create a client
    // This client can only call live.connect, never sees your api key.
    client = new GoogleGenAI({
      apiKey: token.name,
      apiVersion: 'v1alpha',
    });
  }

  await live(client, model).catch((e) => console.error('got error', e));
}

main();
    ```
*   **Link (Live Chat with URL Context):** [`live_client_content_with_url_context.ts`](https://github.com/googleapis/js-genai/raw/refs/heads/main/sdk-samples/live_client_content_with_url_context.ts)
*   **Content:**
    ```typescript
    /**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {GoogleGenAI, LiveServerMessage, Modality} from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_GENAI_USE_VERTEXAI = process.env.GOOGLE_GENAI_USE_VERTEXAI;

async function live(client: GoogleGenAI, model: string) {
  const responseQueue: LiveServerMessage[] = [];

  // This should use an async queue.
  async function waitMessage(): Promise<LiveServerMessage> {
    let done = false;
    let message: LiveServerMessage | undefined = undefined;
    while (!done) {
      message = responseQueue.shift();
      if (message) {
        console.log(JSON.stringify(message));
        done = true;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    return message!;
  }

  async function handleTurn(): Promise<LiveServerMessage[]> {
    const turn: LiveServerMessage[] = [];
    let done = false;
    while (!done) {
      const message = await waitMessage();
      turn.push(message);
      if (message.serverContent && message.serverContent.turnComplete) {
        done = true;
      }
    }
    return turn;
  }

  const session = await client.live.connect({
    model: model,
    callbacks: {
      onopen: function () {
        console.debug('Opened');
      },
      onmessage: function (message: LiveServerMessage) {
        responseQueue.push(message);
      },
      onerror: function (e: ErrorEvent) {
        console.debug('Error:', e.message);
      },
      onclose: function (e: CloseEvent) {
        console.debug('Close:', e.reason);
      },
    },
    config: {
      responseModalities: [Modality.TEXT],
      tools: [
        {
          urlContext: {},
        },
      ],
    },
  });

  const simple = 'What are the top headlines on https://news.google.com';
  console.log('-'.repeat(80));
  console.log(`Sent: ${simple}`);
  session.sendClientContent({turns: simple});

  await handleTurn();

  session.close();
}

async function main() {
  if (GOOGLE_GENAI_USE_VERTEXAI) {
    console.log("urlContext isn't supported on Vertex AI");
  } else {
    const client = new GoogleGenAI({
      vertexai: false,
      apiKey: GEMINI_API_KEY,
    });
    const model = 'gemini-2.0-flash-live-001';
    await live(client, model).catch((e) => console.error('got error', e));
  }
}

main();
    ```

---

## **OPEN AI**

### **Note: General**
We always want to stream responses whenever possible. API/procedure is the same whether we using our keys with Azure or using user's keys dierctly with open ai. difference is in initialiation of the client.

### **Note: Initializing Client (Our Keys/Azure)**
```typescript
import { AzureOpenAI } from "openai";

const endpoint = process.env.AZURE_OPENAI_ENDPOINT || "Your endpoint";
const apiKey = process.env.AZURE_OPENAI_API_KEY || "Your API key";
const apiVersion = process.env.OPENAI_API_VERSION || "2024-07-01-preview";
const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-4-with-turbo";

function getClient(): AzureOpenAI {
  return new AzureOpenAI({
    endpoint,
    apiKey,
    apiVersion,
    deployment: deploymentName,
  });
}
const client = getClient();
```

### **Note: Initializing Client (User's Key)**
```typescript
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "sk-YourAPIKeyHere", 
});
```

### **Note: Responses API Docs**
*   The attached docs of the response API only has python examples, but it's a simliar process with the typescript open ai sdk too. Also, take note of our initialization methods above in typescript (since the sdk does it differntly with python).
*   **Link:** [`responses?tabs=python-key`](https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/responses?tabs=python-key)
*   **Content (Key Concepts):**
    ```
    Learn  Azure  AI Foundry  Azure OpenAI 
Azure OpenAI Responses API (Preview)
05/27/2025
The Responses API is a new stateful API from Azure OpenAI. It brings together the best capabilities from the chat completions and assistants API in one unified experience. The Responses API also adds support for the new computer-use-preview model which powers the Computer use capability.

Responses API
API support
v1 preview API is required for access to the latest features
Region Availability
The responses API is currently available in the following regions:

australiaeast
eastus
eastus2
francecentral
japaneast
norwayeast
southindia
swedencentral
uaenorth
uksouth
westus
westus3
Model support
gpt-4o (Versions: 2024-11-20, 2024-08-06, 2024-05-13)
gpt-4o-mini (Version: 2024-07-18)
computer-use-preview
gpt-4.1 (Version: 2025-04-14)
gpt-4.1-nano (Version: 2025-04-14)
gpt-4.1-mini (Version: 2025-04-14)
gpt-image-1 (Version: 2025-04-15)
o3 (Version: 2025-04-16)
o4-mini (Version: 2025-04-16)
Not every model is available in the regions supported by the responses API. Check the models page for model region availability.

 Note

Not currently supported:

The web search tool
Fine-tuned models
Image generation via streaming. Coming soon.
Images can't be uploaded as a file and then referenced as input. Coming soon.
There's a known issue with performance when background mode is used with streaming. The issue is expected to be resolved soon.
Reference documentation
Responses API reference documentation
Getting started with the responses API
To access the responses API commands, you need to upgrade your version of the OpenAI library.

Windows Command Prompt

Copy
pip install --upgrade openai
Generate a text response
Python (Microsoft Entra ID)
Python (API Key)
REST API
Output
 Important

Use API keys with caution. Don't include the API key directly in your code, and never post it publicly. If you use an API key, store it securely in Azure Key Vault. For more information about using API keys securely in your apps, see API keys with Azure Key Vault.

For more information about AI services security, see Authenticate requests to Azure AI services.

Python

Copy
import os
from openai import OpenAI

client = OpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    base_url="https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/",
    default_query={"api-version": "preview"}, 
)

response = client.responses.create(   
  model="gpt-4.1-nano", # Replace with your model deployment name 
  input="This is a test.",
)

print(response.model_dump_json(indent=2)) 
Retrieve a response
To retrieve a response from a previous call to the responses API.

Python (Microsoft Entra ID)
Python (API Key)
REST API
Output
 Important

Use API keys with caution. Don't include the API key directly in your code, and never post it publicly. If you use an API key, store it securely in Azure Key Vault. For more information about using API keys securely in your apps, see API keys with Azure Key Vault.

For more information about AI services security, see Authenticate requests to Azure AI services.

Python

Copy
import os
from openai import OpenAI

client = OpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    base_url="https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/",
    default_query={"api-version": "preview"}, 
)

response = client.responses.retrieve("resp_67cb61fa3a448190bcf2c42d96f0d1a8")
Delete response
By default response data is retained for 30 days. To delete a response, you can use response.delete"("{response_id})

Python

Copy
from openai import AzureOpenAI
from azure.identity import DefaultAzureCredential, get_bearer_token_provider

token_provider = get_bearer_token_provider(
    DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
)

client = AzureOpenAI(  
  base_url = "https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/",  
  azure_ad_token_provider=token_provider,
  api_version="preview"
)

response = client.responses.delete("resp_67cb61fa3a448190bcf2c42d96f0d1a8")

print(response)
Chaining responses together
You can chain responses together by passing the response.id from the previous response to the previous_response_id parameter.

Python

Copy
from openai import AzureOpenAI
from azure.identity import DefaultAzureCredential, get_bearer_token_provider

token_provider = get_bearer_token_provider(
    DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
)

client = AzureOpenAI(  
  base_url = "https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/",  
  azure_ad_token_provider=token_provider,
  api_version="preview"
)

response = client.responses.create(
    model="gpt-4o",  # replace with your model deployment name
    input="Define and explain the concept of catastrophic forgetting?"
)

second_response = client.responses.create(
    model="gpt-4o",  # replace with your model deployment name
    previous_response_id=response.id,
    input=[{"role": "user", "content": "Explain this at a level that could be understood by a college freshman"}]
)
print(second_response.model_dump_json(indent=2)) 
Note from the output that even though we never shared the first input question with the second_response API call, by passing the previous_response_id the model has full context of previous question and response to answer the new question.

Output:

JSON

Copy
{
  "id": "resp_67cbc9705fc08190bbe455c5ba3d6daf",
  "created_at": 1741408624.0,
  "error": null,
  "incomplete_details": null,
  "instructions": null,
  "metadata": {},
  "model": "gpt-4o-2024-08-06",
  "object": "response",
  "output": [
    {
      "id": "msg_67cbc970fd0881908353a4298996b3f6",
      "content": [
        {
          "annotations": [],
          "text": "Sure! Imagine you are studying for exams in different subjects like math, history, and biology. You spend a lot of time studying math first and get really good at it. But then, you switch to studying history. If you spend all your time and focus on history, you might forget some of the math concepts you learned earlier because your brain fills up with all the new history facts. \n\nIn the world of artificial intelligence (AI) and machine learning, a similar thing can happen with computers. We use special programs called neural networks to help computers learn things, sort of like how our brain works. But when a neural network learns a new task, it can forget what it learned before. This is what we call \"catastrophic forgetting.\"\n\nSo, if a neural network learned how to recognize cats in pictures, and then you teach it how to recognize dogs, it might get really good at recognizing dogs but suddenly become worse at recognizing cats. This happens because the process of learning new information can overwrite or mess with the old information in its \"memory.\"\n\nScientists and engineers are working on ways to help computers remember everything they learn, even as they keep learning new things, just like students have to remember math, history, and biology all at the same time for their exams. They use different techniques to make sure the neural network doesn’t forget the important stuff it learned before, even when it gets new information.",
          "type": "output_text"
        }
      ],
      "role": "assistant",
      "status": null,
      "type": "message"
    }
  ],
  "parallel_tool_calls": null,
  "temperature": 1.0,
  "tool_choice": null,
  "tools": [],
  "top_p": 1.0,
  "max_output_tokens": null,
  "previous_response_id": "resp_67cbc96babbc8190b0f69aedc655f173",
  "reasoning": null,
  "status": "completed",
  "text": null,
  "truncation": null,
  "usage": {
    "input_tokens": 405,
    "output_tokens": 285,
    "output_tokens_details": {
      "reasoning_tokens": 0
    },
    "total_tokens": 690
  },
  "user": null,
  "reasoning_effort": null
}
Chaining responses manually
Alternatively you can manually chain responses together using the method below:

Python

Copy
from openai import AzureOpenAI
from azure.identity import DefaultAzureCredential, get_bearer_token_provider

token_provider = get_bearer_token_provider(
    DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
)

client = AzureOpenAI(  
  base_url = "https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/",  
  azure_ad_token_provider=token_provider,
  api_version="preview"
)


inputs = [{"type": "message", "role": "user", "content": "Define and explain the concept of catastrophic forgetting?"}] 
  
response = client.responses.create(  
    model="gpt-4o",  # replace with your model deployment name  
    input=inputs  
)  
  
inputs += response.output

inputs.append({"role": "user", "type": "message", "content": "Explain this at a level that could be understood by a college freshman"}) 
               

second_response = client.responses.create(  
    model="gpt-4o",  
    input=inputs
)  
      
print(second_response.model_dump_json(indent=2))  
Streaming
Python

Copy
from openai import AzureOpenAI
from azure.identity import DefaultAzureCredential, get_bearer_token_provider

token_provider = get_bearer_token_provider(
    DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
)

client = AzureOpenAI(  
  base_url = "https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/",  
  azure_ad_token_provider=token_provider,
  api_version="preview"
)

response = client.responses.create(
    input = "This is a test",
    model = "o4-mini", # replace with model deployment name
    stream = True
)

for event in response:
    if event.type == 'response.output_text.delta':
        print(event.delta, end='')

Function calling
The responses API supports function calling.

Python

Copy
from openai import AzureOpenAI
from azure.identity import DefaultAzureCredential, get_bearer_token_provider

token_provider = get_bearer_token_provider(
    DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
)

client = AzureOpenAI(  
  base_url = "https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/",  
  azure_ad_token_provider=token_provider,
  api_version="preview"
)

response = client.responses.create(  
    model="gpt-4o",  # replace with your model deployment name  
    tools=[  
        {  
            "type": "function",  
            "name": "get_weather",  
            "description": "Get the weather for a location",  
            "parameters": {  
                "type": "object",  
                "properties": {  
                    "location": {"type": "string"},  
                },  
                "required": ["location"],  
            },  
        }  
    ],  
    input=[{"role": "user", "content": "What's the weather in San Francisco?"}],  
)  

print(response.model_dump_json(indent=2))  
  
# To provide output to tools, add a response for each tool call to an array passed  
# to the next response as `input`  
input = []  
for output in response.output:  
    if output.type == "function_call":  
        match output.name:  
            case "get_weather":  
                input.append(  
                    {  
                        "type": "function_call_output",  
                        "call_id": output.call_id,  
                        "output": '{"temperature": "70 degrees"}',  
                    }  
                )  
            case _:  
                raise ValueError(f"Unknown function call: {output.name}")  
  
second_response = client.responses.create(  
    model="gpt-4o",  
    previous_response_id=response.id,  
    input=input  
)  

print(second_response.model_dump_json(indent=2)) 

List input items
Python

Copy
from openai import AzureOpenAI
from azure.identity import DefaultAzureCredential, get_bearer_token_provider

token_provider = get_bearer_token_provider(
    DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
)

client = AzureOpenAI(  
  base_url = "https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/",  
  azure_ad_token_provider=token_provider,
  api_version="preview"
)

response = client.responses.input_items.list("resp_67d856fcfba0819081fd3cffee2aa1c0")

print(response.model_dump_json(indent=2))
Output:

JSON

Copy
{
  "data": [
    {
      "id": "msg_67d856fcfc1c8190ad3102fc01994c5f",
      "content": [
        {
          "text": "This is a test.",
          "type": "input_text"
        }
      ],
      "role": "user",
      "status": "completed",
      "type": "message"
    }
  ],
  "has_more": false,
  "object": "list",
  "first_id": "msg_67d856fcfc1c8190ad3102fc01994c5f",
  "last_id": "msg_67d856fcfc1c8190ad3102fc01994c5f"
}
Image input
Image url
Python

Copy
from openai import AzureOpenAI
from azure.identity import DefaultAzureCredential, get_bearer_token_provider

token_provider = get_bearer_token_provider(
    DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
)

client = AzureOpenAI(  
  base_url = "https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/",  
  azure_ad_token_provider=token_provider,
  api_version="preview"
)

response = client.responses.create(
    model="gpt-4o",
    input=[
        {
            "role": "user",
            "content": [
                { "type": "input_text", "text": "what is in this image?" },
                {
                    "type": "input_image",
                    "image_url": "<image_URL>"
                }
            ]
        }
    ]
)

print(response)

Base64 encoded image
Python

Copy
import base64
from openai import AzureOpenAI
from azure.identity import DefaultAzureCredential, get_bearer_token_provider

token_provider = get_bearer_token_provider(
    DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
)

client = AzureOpenAI(  
  base_url = "https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/",  
  azure_ad_token_provider=token_provider,
  api_version="preview"
)

def encode_image(image_path):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode("utf-8")

# Path to your image
image_path = "path_to_your_image.jpg"

# Getting the Base64 string
base64_image = encode_image(image_path)

response = client.responses.create(
    model="gpt-4o",
    input=[
        {
            "role": "user",
            "content": [
                { "type": "input_text", "text": "what is in this image?" },
                {
                    "type": "input_image",
                    "image_url": f"data:image/jpeg;base64,{base64_image}"
                }
            ]
        }
    ]
)

print(response)
Using remote MCP servers
You can extend the capabilities of your model by connecting it to tools hosted on remote Model Context Protocol (MCP) servers. These servers are maintained by developers and organizations and expose tools that can be accessed by MCP-compatible clients, such as the Responses API.

Model Context Protocol (MCP) is an open standard that defines how applications provide tools and contextual data to large language models (LLMs). It enables consistent, scalable integration of external tools into model workflows.

The following example demonstrates how to use the fictitious MCP server to query information about the Azure REST API. This allows the model to retrieve and reason over repository content in real time.

Bash

Copy
curl https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/responses?api-version=preview \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AZURE_OPENAI_AUTH_TOKEN" \
  -d '{
  "model": "gpt-4.1",
  "tools": [
    {
      "type": "mcp",
      "server_label": "github",
      "server_url": "https://contoso.com/Azure/azure-rest-api-specs",
      "require_approval": "never"
    }
  ],
  "input": "What is this repo in 100 words?"
}'
Python

Copy
from openai import AzureOpenAI
from azure.identity import DefaultAzureCredential, get_bearer_token_provider

token_provider = get_bearer_token_provider(
    DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
)

client = AzureOpenAI(  
  base_url = "https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/",  
  azure_ad_token_provider=token_provider,
  api_version="preview"
)

response = client.responses.create(
    model="gpt-4.1", # replace with your model deployment name 
    tools=[
        {
            "type": "mcp",
            "server_label": "github",
            "server_url": "https://contoso.com/Azure/azure-rest-api-specs",
            "require_approval": "never"
        },
    ],
    input="What transport protocols are supported in the 2025-03-26 version of the MCP spec?",
)

print(response.output_text)
The MCP tool works only in the Responses API, and is available across all newer models (gpt-4o, gpt-4.1, and our reasoning models). When you're using the MCP tool, you only pay for tokens used when importing tool definitions or making tool calls—there are no additional fees involved.

Approvals
By default, the Responses API requires explicit approval before any data is shared with a remote MCP server. This approval step helps ensure transparency and gives you control over what information is sent externally.

We recommend reviewing all data being shared with remote MCP servers and optionally logging it for auditing purposes.

When an approval is required, the model returns a mcp_approval_request item in the response output. This object contains the details of the pending request and allows you to inspect or modify the data before proceeding.

JSON

Copy
{
  "id": "mcpr_682bd9cd428c8198b170dc6b549d66fc016e86a03f4cc828",
  "type": "mcp_approval_request",
  "arguments": {},
  "name": "fetch_azure_rest_api_docs",
  "server_label": "github"
}
To proceed with the remote MCP call, you must respond to the approval request by creating a new response object that includes an mcp_approval_response item. This object confirms your intent to allow the model to send the specified data to the remote MCP server.

Bash

Copy
curl https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/responses?api-version=preview \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AZURE_OPENAI_AUTH_TOKEN" \
  -d '{
  "model": "gpt-4.1",
  "tools": [
    {
      "type": "mcp",
      "server_label": "github",
      "server_url": "https://contoso.com/Azure/azure-rest-api-specs",
      "require_approval": "never"
    }
  ],
  "previous_response_id": "resp_682f750c5f9c8198aee5b480980b5cf60351aee697a7cd77",
  "input": [{
    "type": "mcp_approval_response",
    "approve": true,
    "approval_request_id": "mcpr_682bd9cd428c8198b170dc6b549d66fc016e86a03f4cc828"
  }]
}'
Python

Copy
from openai import AzureOpenAI
from azure.identity import DefaultAzureCredential, get_bearer_token_provider

token_provider = get_bearer_token_provider(
    DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
)

client = AzureOpenAI(  
  base_url = "https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/",  
  azure_ad_token_provider=token_provider,
  api_version="preview"
)

response = client.responses.create(
    model="gpt-4.1", # replace with your model deployment name 
    tools=[
        {
            "type": "mcp",
            "server_label": "github",
            "server_url": "https://contoso.com/Azure/azure-rest-api-specs",
            "require_approval": "never"
        },
    ],
    previous_response_id="resp_682f750c5f9c8198aee5b480980b5cf60351aee697a7cd77",
    input=[{
        "type": "mcp_approval_response",
        "approve": True,
        "approval_request_id": "mcpr_682bd9cd428c8198b170dc6b549d66fc016e86a03f4cc828"
    }],
)
Authentication
Unlike the GitHub MCP server, most remote MCP servers require authentication. The MCP tool in the Responses API supports custom headers, allowing you to securely connect to these servers using the authentication scheme they require.

You can specify headers such as API keys, OAuth access tokens, or other credentials directly in your request. The most commonly used header is the Authorization header.

Bash

Copy
curl https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/responses?api-version=preview \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AZURE_OPENAI_AUTH_TOKEN" \
  -d '{
        "model": "gpt-4.1",
        "input": "What is this repo in 100 words?"
        "tools": [
            {
                "type": "mcp",
                "server_label": "github",
                "server_url": "https://contoso.com/Azure/azure-rest-api-specs",
                "headers": {
                    "Authorization": "Bearer $YOUR_API_KEY"
            }
        ]
    }'
Python

Copy
from openai import AzureOpenAI
from azure.identity import DefaultAzureCredential, get_bearer_token_provider

token_provider = get_bearer_token_provider(
    DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
)

client = AzureOpenAI(  
  base_url = "https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/",  
  azure_ad_token_provider=token_provider,
  api_version="preview"
)

response = client.responses.create(
    model="gpt-4.1",
    input="What is this repo in 100 words?",
    tools=[
        {
            "type": "mcp",
            "server_label": "github",
            "server_url": "https://gitmcp.io/Azure/azure-rest-api-specs",
            "headers": {
                "Authorization": "Bearer $YOUR_API_KEY"
        }
    ]
)

print(response.output_text)
Background tasks
Background mode allows you to run long-running tasks asynchronously using models like o3 and o1-pro. This is especially useful for complex reasoning tasks that may take several minutes to complete, such as those handled by agents like Codex or Deep Research.

By enabling background mode, you can avoid timeouts and maintain reliability during extended operations. When a request is sent with "background": true, the task is processed asynchronously, and you can poll for its status over time.

To start a background task, set the background parameter to true in your request:

Bash

Copy
curl https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/responses?api-version=preview \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AZURE_OPENAI_AUTH_TOKEN" \
  -d '{
    "model": "o3",
    "input": "Write me a very long story",
    "background": true
  }'
Python

Copy
from openai import AzureOpenAI
from azure.identity import DefaultAzureCredential, get_bearer_token_provider

token_provider = get_bearer_token_provider(
    DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
)

client = AzureOpenAI(  
  base_url = "https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/",  
  azure_ad_token_provider=token_provider,
  api_version="preview"
)

response = client.responses.create(
    model = "o3",
    input = "Write me a very long story",
    background = True
)

print(response.status)
Use the GET endpoint to check the status of a background response. Continue polling while the status is queued or in_progress. Once the response reaches a final (terminal) state, it will be available for retrieval.

Bash

Copy
curl GET https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/responses/resp_1234567890?api-version=preview \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AZURE_OPENAI_AUTH_TOKEN"
Python

Copy
from openai import AzureOpenAI
from azure.identity import DefaultAzureCredential, get_bearer_token_provider
from time import sleep

token_provider = get_bearer_token_provider(
    DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
)

client = AzureOpenAI(  
  base_url = "https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/",  
  azure_ad_token_provider=token_provider,
  api_version="preview"
)

response = client.responses.create(
    model = "o3",
    input = "Write me a very long story",
    background = True
)

while response.status in {"queued", "in_progress"}:
    print(f"Current status: {response.status}")
    sleep(2)
    response = client.responses.retrieve(response.id)

print(f"Final status: {response.status}\nOutput:\n{response.output_text}")
You can cancel an in-progress background task using the cancel endpoint. Canceling is idempotent—subsequent calls will return the final response object.

Bash

Copy
curl -X POST https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/responses/resp_1234567890/cancel?api-version=preview \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AZURE_OPENAI_AUTH_TOKEN"
Python

Copy
from openai import AzureOpenAI
from azure.identity import DefaultAzureCredential, get_bearer_token_provider

token_provider = get_bearer_token_provider(
    DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
)

client = AzureOpenAI(  
  base_url = "https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/",  
  azure_ad_token_provider=token_provider,
  api_version="preview"
)

response = client.responses.cancel("resp_1234567890")

print(response.status)
Stream a background response
To stream a background response, set both background and stream to true. This is useful if you want to resume streaming later in case of a dropped connection. Use the sequence_number from each event to track your position.

Bash

Copy
curl https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/responses?api-version=preview \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AZURE_OPENAI_AUTH_TOKEN" \
  -d '{
    "model": "o3",
    "input": "Write me a very long story",
    "background": true,
    "stream": true
  }'

Python

Copy
from openai import AzureOpenAI
from azure.identity import DefaultAzureCredential, get_bearer_token_provider

token_provider = get_bearer_token_provider(
    DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
)

client = AzureOpenAI(  
  base_url = "https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/",  
  azure_ad_token_provider=token_provider,
  api_version="preview"
)

# Fire off an async response but also start streaming immediately
stream = client.responses.create(
    model="o3",
    input="Write me a very long story",
    background=True,
    stream=True,
)

cursor = None
for event in stream:
    print(event)
    cursor = event["sequence_number"]
 Note

Background responses currently have a higher time-to-first-token latency than synchronous responses. Improvements are underway to reduce this gap.

Limitations
Background mode requires store=true. Stateless requests are not supported.
You can only resume streaming if the original request included stream=true.
To cancel a synchronous response, terminate the connection directly.
Resume streaming from a specific point
Bash

Copy
curl https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/responses/resp_1234567890?stream=true&starting_after=42&api-version=2025-04-01-preview \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AZURE_OPENAI_AUTH_TOKEN"
Encrypted Reasoning Items
When using the Responses API in stateless mode — either by setting store to false or when your organization is enrolled in zero data retention — you must still preserve reasoning context across conversation turns. To do this, include encrypted reasoning items in your API requests.

To retain reasoning items across turns, add reasoning.encrypted_content to the include parameter in your request. This ensures that the response includes an encrypted version of the reasoning trace, which can be passed along in future requests.

Bash

Copy
curl https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/responses?api-version=preview \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AZURE_OPENAI_AUTH_TOKEN" \
  -d '{
    "model": "o4-mini",
    "reasoning": {"effort": "medium"},
    "input": "What is the weather like today?",
    "tools": [<YOUR_FUNCTION GOES HERE>],
    "include": ["reasoning.encrypted_content"]
  }'
Image generation
The Responses API enables image generation as part of conversations and multi-step workflows. It supports image inputs and outputs within context and includes built-in tools for generating and editing images.

Compared to the standalone Image API, the Responses API offers several advantages:

Multi-turn editing: Iteratively refine and edit images using natural language prompts.
Streaming: Display partial image outputs during generation to improve perceived latency.
Flexible inputs: Accept image File IDs as inputs, in addition to raw image bytes.
 Note

The image generation tool in the Responses API is only supported by the gpt-image-1 model. You can however call this model from this list of supported models - gpt-4o, gpt-4o-mini, gpt-4.1, gpt-4.1-mini, gpt-4.1-nano, o3.

Use the Responses API if you want to:

Build conversational image experiences with GPT Image.
Enable iterative image editing through multi-turn prompts.
Stream partial image results during generation for a smoother user experience.
Generate an image

Python

Copy
from openai import AzureOpenAI
from azure.identity import DefaultAzureCredential, get_bearer_token_provider

token_provider = get_bearer_token_provider(
    DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
)

client = AzureOpenAI(  
  base_url = "https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/",  
  azure_ad_token_provider=token_provider,
  api_version="preview",
  default_headers={"x-ms-oai-image-generation-deployment":"YOUR-GPT-IMAGE1-DEPLOYMENT-NAME"}
)

response = client.responses.create(
    model="o3",
    input="Generate an image of gray tabby cat hugging an otter with an orange scarf",
    tools=[{"type": "image_generation"}],
)

# Save the image to a file
image_data = [
    output.result
    for output in response.output
    if output.type == "image_generation_call"
]
    
if image_data:
    image_base64 = image_data[0]
    with open("otter.png", "wb") as f:
        f.write(base64.b64decode(image_base64))
You can perform multi-turn image generation by using the output of image generation in subsequent calls or just using the 1previous_response_id.

Python

Copy
from openai import AzureOpenAI
from azure.identity import DefaultAzureCredential, get_bearer_token_provider

token_provider = get_bearer_token_provider(
    DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
)

client = AzureOpenAI(  
  base_url = "https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/",  
  azure_ad_token_provider=token_provider,
  api_version="preview",
  default_headers={"x-ms-oai-image-generation-deployment":"YOUR-GPT-IMAGE1-DEPLOYMENT-NAME"}
)

image_data = [
    output.result
    for output in response.output
    if output.type == "image_generation_call"
]

if image_data:
    image_base64 = image_data[0]

    with open("cat_and_otter.png", "wb") as f:
        f.write(base64.b64decode(image_base64))


# Follow up

response_followup = client.responses.create(
    model="gpt-4.1-mini",
    previous_response_id=response.id,
    input="Now make it look realistic",
    tools=[{"type": "image_generation"}],
)

image_data_followup = [
    output.result
    for output in response_followup.output
    if output.type == "image_generation_call"
]

if image_data_followup:
    image_base64 = image_data_followup[0]
    with open("cat_and_otter_realistic.png", "wb") as f:
        f.write(base64.b64decode(image_base64))
Streaming
You can stream partial images using Responses API. The partial_images can be used to receive 1-3 partial images

Python

Copy
from openai import AzureOpenAI
from azure.identity import DefaultAzureCredential, get_bearer_token_provider

token_provider = get_bearer_token_provider(
    DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
)

client = AzureOpenAI(  
  base_url = "https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/",  
  azure_ad_token_provider=token_provider,
  api_version="preview",
  default_headers={"x-ms-oai-image-generation-deployment":"YOUR-GPT-IMAGE1-DEPLOYMENT-NAME"}
)

stream = client.responses.create(
    model="gpt-4.1",
    input="Draw a gorgeous image of a river made of white owl feathers, snaking its way through a serene winter landscape",
    stream=True,
    tools=[{"type": "image_generation", "partial_images": 2}],
)

for event in stream:
    if event.type == "response.image_generation_call.partial_image":
        idx = event.partial_image_index
        image_base64 = event.partial_image_b64
        image_bytes = base64.b64decode(image_base64)
        with open(f"river{idx}.png", "wb") as f:
            f.write(image_bytes)
Edit images
Python

Copy
from openai import AzureOpenAI
from azure.identity import DefaultAzureCredential, get_bearer_token_provider
import base64

client = AzureOpenAI(  
  base_url = "https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/",  
  azure_ad_token_provider=token_provider,
  api_version="preview",
  default_headers={"x-ms-oai-image-generation-deployment":"YOUR-GPT-IMAGE1-DEPLOYMENT-NAME"}
)

def create_file(file_path):
  with open(file_path, "rb") as file_content:
    result = client.files.create(
        file=file_content,
        purpose="vision",
    )
    return result.id

def encode_image(file_path):
    with open(file_path, "rb") as f:
        base64_image = base64.b64encode(f.read()).decode("utf-8")
    return base64_image

prompt = """Generate a photorealistic image of a gift basket on a white background 
labeled 'Relax & Unwind' with a ribbon and handwriting-like font, 
containing all the items in the reference pictures."""

base64_image1 = encode_image("image1.png")
base64_image2 = encode_image("image2.png")
file_id1 = create_file("image3.png")
file_id2 = create_file("image4.png")

response = client.responses.create(
    model="gpt-4.1",
    input=[
        {
            "role": "user",
            "content": [
                {"type": "input_text", "text": prompt},
                {
                    "type": "input_image",
                    "image_url": f"data:image/jpeg;base64,{base64_image1}",
                },
                {
                    "type": "input_image",
                    "image_url": f"data:image/jpeg;base64,{base64_image2}",
                },
                {
                    "type": "input_image",
                    "file_id": file_id1,
                },
                {
                    "type": "input_image",
                    "file_id": file_id2,
                }
            ],
        }
    ],
    tools=[{"type": "image_generation"}],
)

image_generation_calls = [
    output
    for output in response.output
    if output.type == "image_generation_call"
]

image_data = [output.result for output in image_generation_calls]

if image_data:
    image_base64 = image_data[0]
    with open("gift-basket.png", "wb") as f:
        f.write(base64.b64decode(image_base64))
else:
    print(response.output.content)
    ```

### **Note: Streaming**
*   **Link:** [`responsesStream.ts`](https://github.com/Azure/azure-sdk-for-js/raw/refs/heads/main/sdk/openai/openai/samples/v2-beta/typescript/src/responsesStream.ts)
*   **Content:**
    ```typescript
    // Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Demonstrates how to stream text responses from Azure OpenAI.
 *
 * @summary streams text completions from Azure OpenAI.
 */

import { AzureOpenAI } from "openai";
import { DefaultAzureCredential, getBearerTokenProvider } from "@azure/identity";

// Set AZURE_OPENAI_ENDPOINT to the endpoint of your
// OpenAI resource. You can find this in the Azure portal.
// Load the .env file if it exists
import "dotenv/config";

async function main() {
  const scope = "https://cognitiveservices.azure.com/.default";
  const azureADTokenProvider = getBearerTokenProvider(new DefaultAzureCredential(), scope);
  const deployment = "gpt-4-1106-preview";
  const apiVersion = "2025-03-01-preview";
  const client = new AzureOpenAI({ azureADTokenProvider, deployment, apiVersion });

  const runner = client.responses
    .stream({
      model: deployment,
      input: "solve 8x + 31 = 2",
    })
    .on("event", (event) => console.log(event))
    .on("response.output_text.delta", (diff) => process.stdout.write(diff.delta));

  for await (const event of runner) {
    console.log("event", event);
  }

  const result = await runner.finalResponse();
  console.log(result);
}

main();
    ```

### **Note: Image Upload/Input**
Upload to files api then reference its id iin the request, see snippet below:
```typescript
import OpenAI from "openai";
import fs from "fs";

const openai = new OpenAI();

// Function to create a file with the Files API
async function createFile(filePath: string) {
  const fileContent = fs.createReadStream(filePath);
  const result = await openai.files.create({
    file: fileContent,
    purpose: "vision",
  });
  return result.id;
}

// Getting the file ID
const fileId = await createFile("path_to_your_image.jpg");

const response = await openai.responses.create({
  model: "gpt-4.1-mini",
  input: [
    {
      role: "user",
      content: [
        { type: "input_text", text: "what's in this image?" },
        {
          type: "input_image",
          file_id: fileId,
        },
      ],
    },
  ],
});

console.log(response.output_text);
```

### **Note: File Uploads (not using base64)**
*   This is from the open ai docs not azure's but their procedure is similar.
*   **Link:** [`pdf-files?api-mode=responses&lang=javascript`](https://platform.openai.com/docs/guides/pdf-files?api-mode=responses&lang=javascript)
*   **Content (Key Concepts):**
    ```
    File inputs
===========

Learn how to use PDF files as inputs to the OpenAI API.

OpenAI models with vision capabilities can also accept PDF files as input. Provide PDFs either as Base64-encoded data or as file IDs obtained after uploading files to the `/v1/files` endpoint through the [API](/docs/api-reference/files) or [dashboard](/storage/files/).

How it works
------------

To help models understand PDF content, we put into the model's context both the extracted text and an image of each page. The model can then use both the text and the images to generate a response. This is useful, for example, if diagrams contain key information that isn't in the text.

Uploading files
---------------

In the example below, we first upload a PDF using the [Files API](/docs/api-reference/files), then reference its file ID in an API request to the model.

Upload a file to use in a response

```bash
curl https://api.openai.com/v1/files \
    -H "Authorization: Bearer $OPENAI_API_KEY" \
    -F purpose="user_data" \
    -F file="@draconomicon.pdf"

curl "https://api.openai.com/v1/responses" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $OPENAI_API_KEY" \
    -d '{
        "model": "gpt-4.1",
        "input": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_file",
                        "file_id": "file-6F2ksmvXxt4VdoqmHRw6kL"
                    },
                    {
                        "type": "input_text",
                        "text": "What is the first dragon in the book?"
                    }
                ]
            }
        ]
    }'
```

```javascript
import fs from "fs";
import OpenAI from "openai";
const client = new OpenAI();

const file = await client.files.create({
    file: fs.createReadStream("draconomicon.pdf"),
    purpose: "user_data",
});

const response = await client.responses.create({
    model: "gpt-4.1",
    input: [
        {
            role: "user",
            content: [
                {
                    type: "input_file",
                    file_id: file.id,
                },
                {
                    type: "input_text",
                    text: "What is the first dragon in the book?",
                },
            ],
        },
    ],
});

console.log(response.output_text);
```

```python
from openai import OpenAI
client = OpenAI()

file = client.files.create(
    file=open("draconomicon.pdf", "rb"),
    purpose="user_data"
)

response = client.responses.create(
    model="gpt-4.1",
    input=[
        {
            "role": "user",
            "content": [
                {
                    "type": "input_file",
                    "file_id": file.id,
                },
                {
                    "type": "input_text",
                    "text": "What is the first dragon in the book?",
                },
            ]
        }
    ]
)

print(response.output_text)
```

Base64-encoded files
--------------------

You can send PDF file inputs as Base64-encoded inputs as well.

Base64 encode a file to use in a response

```bash
curl "https://api.openai.com/v1/responses" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $OPENAI_API_KEY" \
    -d '{
        "model": "gpt-4.1",
        "input": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_file",
                        "filename": "draconomicon.pdf",
                        "file_data": "...base64 encoded PDF bytes here..."
                    },
                    {
                        "type": "input_text",
                        "text": "What is the first dragon in the book?"
                    }
                ]
            }
        ]
    }'
```

```javascript
import fs from "fs";
import OpenAI from "openai";
const client = new OpenAI();

const data = fs.readFileSync("draconomicon.pdf");
const base64String = data.toString("base64");

const response = await client.responses.create({
    model: "gpt-4.1",
    input: [
        {
            role: "user",
            content: [
                {
                    type: "input_file",
                    filename: "draconomicon.pdf",
                    file_data: `data:application/pdf;base64,${base64String}`,
                },
                {
                    type: "input_text",
                    text: "What is the first dragon in the book?",
                },
            ],
        },
    ],
});

console.log(response.output_text);
```

```python
import base64
from openai import OpenAI
client = OpenAI()

with open("draconomicon.pdf", "rb") as f:
    data = f.read()

base64_string = base64.b64encode(data).decode("utf-8")

response = client.responses.create(
    model="gpt-4.1",
    input=[
        {
            "role": "user",
            "content": [
                {
                    "type": "input_file",
                    "filename": "draconomicon.pdf",
                    "file_data": f"data:application/pdf;base64,{base64_string}",
                },
                {
                    "type": "input_text",
                    "text": "What is the first dragon in the book?",
                },
            ],
        },
    ]
)

print(response.output_text)
```

Usage considerations
--------------------

Below are a few considerations to keep in mind while using PDF inputs.

**Token usage**

To help models understand PDF content, we put into the model's context both extracted text and an image of each page—regardless of whether the page includes images. Before deploying your solution at scale, ensure you understand the pricing and token usage implications of using PDFs as input. [More on pricing](/docs/pricing).

**File size limitations**

You can upload up to 100 pages and 32MB of total content in a single request to the API, across multiple file inputs.

**Supported models**

Only models that support both text and image inputs, such as gpt-4o, gpt-4o-mini, or o1, can accept PDF files as input. [Check model features here](/docs/models).

**File upload purpose**

You can upload these files to the Files API with any [purpose](/docs/api-reference/files/create#files-create-purpose), but we recommend using the `user_data` purpose for files you plan to use as model inputs.

Next steps
----------

Now that you known the basics of text inputs and outputs, you might want to check out one of these resources next.

[

Experiment with PDF inputs in the Playground

Use the Playground to develop and iterate on prompts with PDF inputs.

](/playground)[

Full API reference

Check out the API reference for more options.

](/docs/api-reference/responses)
    ```

### **Note: Web Search**

#### **With Our Creds (Bing Search + Function Calling)**
*   **Note:** Make sure to take this even further to support citations as stated in the notebook. We have some works on source citations already in `#file:MessageList.tsx` and `#file:ai.ts` already, so feel free to emulate and extend.
*   **Link:** [`functions_with_bing_search.ipynb`](https://github.com/Azure-Samples/openai/blob/main/Basic_Samples/Functions/functions_with_bing_search.ipynb)
```*   **Content (Key Concepts):**
   {
 "cells": [
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "# Function calling with Bing Search\n",
    "\n",
    "In this notebook, we'll show how you can use the [Bing Search APIs](https://www.microsoft.com/bing/apis/llm) and [function calling](https://learn.microsoft.com/azure/ai-services/openai/how-to/function-calling?tabs=python) to ground Azure OpenAI models on data from the web. This is a great way to give the model access to up to date data from the web.\n",
    "\n",
    "You'll need to create a [Bing Search resouce](https://learn.microsoft.com/en-us/bing/search-apis/bing-web-search/create-bing-search-service-resource) before you begin."
   ]
  },
  {
   "cell_type": "code",
   "execution_count": 1,
   "metadata": {},
   "outputs": [],
   "source": [
    "import json\n",
    "import os\n",
    "import requests\n",
    "from openai import AzureOpenAI\n",
    "\n",
    "# Load config values\n",
    "with open(r'config.json') as config_file:\n",
    "    config_details = json.load(config_file)\n",
    "    \n",
    "\n",
    "\n",
    "client = AzureOpenAI(\n",
    "    azure_endpoint=config_details[\"AZURE_OPENAI_ENDPOINT\"],  # The base URL for your Azure OpenAI resource. e.g. \"https://<your resource name>.openai.azure.com\"\n",
    "    api_key=os.getenv(\"AZURE_OPENAI_KEY\"),  # The API key for your Azure OpenAI resource.\n",
    "    api_version=config_details[\"OPENAI_API_VERSION\"],  # This version supports function calling\n",
    ")\n",
    "\n",
    "model_name = config_details['MODEL_NAME'] # You need to ensure the version of the model you are using supports the function calling feature\n",
    "\n",
    "bing_search_subscription_key = config_details['BING_SEARCH_SUBSCRIPTION_KEY']\n",
    "bing_search_url = \"https://api.bing.microsoft.com/v7.0/search\""
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 1.0 Define a function to call the Bing Search APIs\n",
    "\n",
    " To learn more about using the Bing Search APIs with Azure OpenAI, see [Bing Search APIs, with your LLM](https://learn.microsoft.com/bing/search-apis/bing-web-search/use-display-requirements-llm)."
   ]
  },
  {
   "cell_type": "code",
   "execution_count": 4,
   "metadata": {},
   "outputs": [],
   "source": [
    "def search(query):\n",
    "    headers = {\"Ocp-Apim-Subscription-Key\": bing_search_subscription_key}\n",
    "    params = {\"q\": query, \"textDecorations\": False }\n",
    "    response = requests.get(bing_search_url, headers=headers, params=params)\n",
    "    response.raise_for_status()\n",
    "    search_results = response.json()\n",
    "\n",
    "    output = []\n",
    "\n",
    "    for result in search_results['webPages']['value']:\n",
    "        output.append({\n",
    "            'title': result['name'],\n",
    "            'link': result['url'],\n",
    "            'snippet': result['snippet']\n",
    "        })\n",
    "\n",
    "    return json.dumps(output)\n"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": 5,
   "metadata": {},
   "outputs": [
    {
     "data": {
      "text/plain": [
       "'[{\"title\": \"2032 Summer Olympics - Wikipedia\", \"link\": \"https://en.wikipedia.org/wiki/2032_Summer_Olympics\", \"snippet\": \"The 2032 Summer Olympics, officially known as the Games of the XXXV Olympiad and also known as Brisbane 2032 ( Yagara: Meanjin 2032 ), [1] is an upcoming international multi-sport event scheduled to take place between 23 July to 8 August 2032, in Brisbane, Queensland, Australia. [2]\"}, {\"title\": \"Venues of the 2032 Summer Olympics and Paralympics\", \"link\": \"https://en.wikipedia.org/wiki/Venues_of_the_2032_Summer_Olympics_and_Paralympics\", \"snippet\": \"Stadium Australia North Queensland Stadium Barlow Park Toowoomba Sports Ground class=notpageimage| 2032 Olympic and Paralympic venues outside South East Queensland Sporting venues The Gabba Brisbane Convention & Exhibition Centre South Bank Piazza Anna Meares Velodrome Sleeman BMX SuperCross Track Brisbane Aquatics Centre Barrambin / Victoria Park\"}, {\"title\": \"The Next Olympics Location: Every Host City Through 2032 | Time\", \"link\": \"https://time.com/5063566/next-olympics-location/\", \"snippet\": \"Mountain events will take place at two locations about 50 and 100 miles outside of Beijing, with natural snowfall topping out at one of them at only five centimeters on average. 2024 Summer...\"}, {\"title\": \"Here\\'s where the 2024, 2026 2028, 2032 Olympic Games will be - The Scotsman\", \"link\": \"https://www.scotsman.com/sport/other-sport/next-olympics-olympic-games-hosts-britain-london-who-latest-news-3321075\", \"snippet\": \"Looking ahead to 2032, Brisbane in Queensland, Australia, has been announced as the winning host location for the 2032 Olympic Games \\\\u2013 which will mark the 34th Olympic Games since records...\"}, {\"title\": \"Where is the next Olympics? Explaining where the Summer and Winter ...\", \"link\": \"https://www.cbssports.com/olympics/news/where-is-the-next-olympics-explaining-where-the-summer-and-winter-games-will-be-held-through-2032/\", \"snippet\": \"The opening and closing ceremonies will take place in SoFi Stadium, home of the Los Angeles Rams and Los Angeles Chargers and site of Super Bowl LVI. The Los Angeles Coliseum will once again hold...\"}, {\"title\": \"Brisbane 2032 Olympic venues announced | Austadiums\", \"link\": \"https://www.austadiums.com/news/921/brisbane-2032-olympic-games-venues-revealed\", \"snippet\": \"The Brisbane 2032 Masterplan includes 32 venues within South-East Queensland for the 28 Olympic sports, located in three primary zones. Not only will Brisbane\\\\u2019s Olympics expand to the entire south-east Queensland, football will also be played in North Queensland as well as Sydney and Melbourne.\"}, {\"title\": \"Brisbane 2032 Summer Olympics - Summer Olympic Games in Australia\", \"link\": \"https://olympics.com/en/olympic-games/brisbane-2032\", \"snippet\": \"Brisbane 2032 23 July - 8 August 3185 days Australia Official website Brisbane 2032 Annual Report 2022-23 Brisbane 2032 | Olympic Games Countdown Begins: Brisbane Celebrates Nine-Year Mark to 2032 Summer Olympics Brisbane 2032 | Olympic Games 01:01 Brisbane 2032 Olympics Marks Nine-Year Milestone with Grand Celebrations\"}, {\"title\": \"2032 Games: Brisbane confirmed as Olympic and Paralympic host\", \"link\": \"https://www.bbc.co.uk/sport/olympics/57912026\", \"snippet\": \"Brisbane will host the 2032 Olympic and Paralympic Games after being approved by the International Olympic Committee. The Australian city was named the preferred bidder before being proposed by...\"}, {\"title\": \"2032 Olympics: Brisbane proposed as host by International Olympic ... - BBC\", \"link\": \"https://www.bbc.com/sport/olympics/57432349\", \"snippet\": \"Australian city Brisbane has moved a step closer to being named the host for the 2032 Olympic Games. ... The delayed 2020 Olympics will be held in Tokyo, Japan in the summer, with Paris in France ...\"}, {\"title\": \"Brisbane 2032 - Olympics.com\", \"link\": \"https://olympics.com/ioc/brisbane-2032\", \"snippet\": \"Olympic Games Brisbane 2032. Find out all about the athletes, sports, schedules, venues, mascot and much more. Learn more. New approach to future host elections. The revolutionary new approach to electing hosts for Olympic Games and youth Olympic Games results in significant cost savings for potential hosts, as well as more sustainable projects ...\"}]'"
      ]
     },
     "execution_count": 5,
     "metadata": {},
     "output_type": "execute_result"
    }
   ],
   "source": [
    "search(\"where will the 2032 olymbics be held?\")"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 2.0 Test function calling"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": 2,
   "metadata": {},
   "outputs": [
    {
     "name": "stdout",
     "output_type": "stream",
     "text": [
      "{\n",
      "  \"role\": \"assistant\",\n",
      "  \"function_call\": {\n",
      "    \"name\": \"search_bing\",\n",
      "    \"arguments\": \"{\\n  \\\"query\\\": \\\"height of mount rainier\\\"\\n}\"\n",
      "  }\n",
      "}\n"
     ]
    }
   ],
   "source": [
    "system_message = \"\"\"You are an assistant designed to help people answer questions.\n",
    "\n",
    "You have access to query the web using Bing Search. You should call bing search whenever a question requires up to date information or could benefit from web data.\n",
    "\"\"\"\n",
    "\n",
    "messages = [{\"role\": \"system\", \"content\": system_message},\n",
    "            {\"role\": \"user\", \"content\": \"How tall is mount rainier?\"}]\n",
    "\n",
    "                \n",
    "tools = [  \n",
    "    {\n",
    "        \"type\": \"function\",\n",
    "        \"function\": {\n",
    "            \"name\": \"search_bing\",\n",
    "            \"description\": \"Searches bing to get up to date information from the web\",\n",
    "            \"parameters\": {\n",
    "                \"type\": \"object\",\n",
    "                \"properties\": {\n",
    "                    \"query\": {\n",
    "                        \"type\": \"string\",\n",
    "                        \"description\": \"The search query\",\n",
    "                    }\n",
    "                },\n",
    "                \"required\": [\"query\"],\n",
    "            },\n",
    "        }\n",
    "    }\n",
    "    \n",
    "]\n",
    "\n",
    "response = client.chat.completions.create(\n",
    "        model=model_name,\n",
    "        messages=messages,\n",
    "        tools=tools,\n",
    "        tool_choice=\"auto\",\n",
    "    )\n",
    "\n",
    "print(response.choices[0].message)"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 3.0 Get things running end to end"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": 9,
   "metadata": {},
   "outputs": [],
   "source": [
    "def run_multiturn_conversation(messages, functions, available_functions, deployment_name):\n",
    "    # Step 1: send the conversation and available functions to GPT\n",
    "\n",
    "    response = client.chat.completions.create(\n",
    "        messages=messages,\n",
    "        tools=tools,\n",
    "        tool_choice=\"auto\",\n",
    "        model=model_name,\n",
    "        temperature=0,\n",
    "    )\n",
    "\n",
    "    # Step 2: check if GPT wanted to call a function\n",
    "    while response.choices[0].finish_reason == \"tool_calls\":\n",
    "        response_message = response.choices[0].message\n",
    "        print(\"Recommended Function call:\")\n",
    "        print(response_message.tool_calls[0])\n",
    "        print()\n",
    "        \n",
    "        # Step 3: call the function\n",
    "        # Note: the JSON response may not always be valid; be sure to handle errors\n",
    "        \n",
    "        function_name = response_message.tool_calls[0].function.name\n",
    "        \n",
    "        # verify function exists\n",
    "        if function_name not in available_functions:\n",
    "            return \"Function \" + function_name + \" does not exist\"\n",
    "        function_to_call = available_functions[function_name]  \n",
    "        \n",
    "        function_args = json.loads(response_message.tool_calls[0].function.arguments)\n",
    "        function_response = function_to_call(**function_args)\n",
    "        \n",
    "        print(\"Output of function call:\")\n",
    "        print(function_response)\n",
    "        print()\n",
    "        \n",
    "        # Step 4: send the info on the function call and function response to GPT\n",
    "        \n",
    "        # adding assistant response to messages\n",
    "        messages.append(\n",
    "            {\n",
    "                \"role\": response_message.role,\n",
    "                \"function_call\": {\n",
    "                    \"name\": response_message.tool_calls[0].function.name,\n",
    "                    \"arguments\": response_message.tool_calls[0].function.arguments,\n",
    "                },\n",
    "                \"content\": None\n",
    "            }\n",
    "        )\n",
    "\n",
    "        # adding function response to messages\n",
    "        messages.append(\n",
    "            {\n",
    "                \"role\": \"function\",\n",
    "                \"name\": function_name,\n",
    "                \"content\": function_response,\n",
    "            }\n",
    "        )  # extend conversation with function response\n",
    "\n",
    "        print(\"Messages in next request:\")\n",
    "        for message in messages:\n",
    "            print(message)\n",
    "        print()\n",
    "\n",
    "        response = client.chat.completions.create(\n",
    "            messages=messages,\n",
    "            tools=tools,\n",
    "            tool_choice=\"auto\",\n",
    "            model=model_name,\n",
    "            temperature=0,\n",
    "        )  # get a new response from GPT where it can see the function response\n",
    "\n",
    "    return response"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": 10,
   "metadata": {},
   "outputs": [
    {
     "name": "stdout",
     "output_type": "stream",
     "text": [
      "Recommended Function call:\n",
      "{\n",
      "  \"name\": \"search_bing\",\n",
      "  \"arguments\": \"{\\n  \\\"query\\\": \\\"height of Mount Rainier\\\"\\n}\"\n",
      "}\n",
      "\n",
      "Output of function call:\n",
      "[{\"title\": \"Mount Rainier - Wikipedia\", \"link\": \"https://en.wikipedia.org/wiki/Mount_Rainier\", \"snippet\": \"Coordinates: 46\\u00b051\\u203210\\u2033N 121\\u00b045\\u203238\\u2033W Mount Rainier seen from the International Space Station Mount Rainier ( / re\\u026a\\u02c8n\\u026a\\u0259r / ray-NEER ), also known as Tahoma, is a large active stratovolcano in the Cascade Range of the Pacific Northwest in the United States.\"}, {\"title\": \"Geology and History Summary for Mount Rainier - USGS.gov\", \"link\": \"https://www.usgs.gov/volcanoes/mount-rainier/geology-and-history-summary-mount-rainier\", \"snippet\": \"Public domain.) Mount Rainier is an active volcano of the Cascade Range in Washington State, 50-70 km (30-44 mi) southeast of the Seattle\\u2013Tacoma metropolitan area. Volcanism occurs at Mount Rainier and other Cascades arc volcanoes because of the subduction of the Juan de Fuca Plate off the western coast of North America.\"}, {\"title\": \"Mount Rainier | U.S. Geological Survey - USGS.gov\", \"link\": \"https://www.usgs.gov/volcanoes/mount-rainier\", \"snippet\": \"Mount Rainier, the highest peak in the Cascade Range at 4,392m (14,410 ft), forms a dramatic backdrop to the Puget Sound region. Summary During an eruption 5,600 years ago the once-higher edifice of Mount Rainier collapsed to form a large crater open to the northeast much like that at Mount St. Helens after 1980.\"}, {\"title\": \"Mount Rainier | National Park, History, Eruptions, & Map\", \"link\": \"https://www.britannica.com/place/Mount-Rainier\", \"snippet\": \"Mount Rainier, highest mountain (14,410 feet [4,392 meters]) in the state of Washington, U.S., and in the Cascade Range. It lies about 40 miles (64 km) southeast of the city of Tacoma, within Mount Rainier National Park. A dormant volcano, it last erupted about 150 years ago.\"}, {\"title\": \"Mount Rainier National Park - Wikipedia\", \"link\": \"https://en.wikipedia.org/wiki/Mount_Rainier_National_Park\", \"snippet\": \"The highest point in the Cascade Range, Mount Rainier is surrounded by valleys, waterfalls, subalpine meadows, and 91,000 acres (142.2 sq mi; 368.3 km 2) of old-growth forest. [4] More than 25 glaciers descend the flanks of the volcano, which is often shrouded in clouds that dump enormous amounts of rain and snow.\"}, {\"title\": \"Mount Rainier National Park (U.S. National Park Service)\", \"link\": \"https://www.nps.gov/mora/index.htm\", \"snippet\": \"Ascending to 14,410 feet above sea level, Mount Rainier stands as an icon in the Washington landscape. An active volcano, Mount Rainier is the most glaciated peak in the contiguous U.S.A., spawning five major rivers. Subalpine wildflower meadows ring the icy volcano while ancient forest cloaks Mount Rainier\\u2019s lower slopes.\"}, {\"title\": \"Mount Rainier Geology | U.S. Geological Survey - USGS.gov\", \"link\": \"https://www.usgs.gov/geology-and-ecology-of-national-parks/mount-rainier-geology\", \"snippet\": \"Mt. Rainier is an active volcano, rising to over 14,000 feet southeast of Seattle. Return to Rainier main page Sources/Usage: Public Domain. A distant view of Mount Rainier volcano over Puyallup Valley, near Orting, Washington.\"}, {\"title\": \"Mount Rainier is a special place - U.S. National Park Service\", \"link\": \"https://www.nps.gov/mora/learn/management/what-s-special.htm\", \"snippet\": \"At a height of 14,410 feet, Mount Rainier is the highest volcanic peak in the contiguous United States. It has the largest alpine glacial system outside of Alaska and the world's largest volcanic glacier cave system (in the summit crater).\"}, {\"title\": \"Frequently Asked Questions - Mount Rainier National Park (U.S. National ...\", \"link\": \"https://www.nps.gov/mora/faqs.htm\", \"snippet\": \"Mount Rainier National Park encompasses 236,380.89 acres or 369.34 square miles within the legislative park boundary, with an additional 140 acres lying outside the boundary. Of that amount, 228,480 acres (97% of the park) has been designated by Congress as Wilderness. The park is also a National Historic Landmark District.\"}]\n",
      "\n",
      "Messages in next request:\n",
      "{'role': 'system', 'content': 'You are an assistant designed to help people answer questions.\\n\\nYou have access to query the web using Bing Search. You should call bing search whenever a question requires up to date information or could benefit from web data.\\n'}\n",
      "{'role': 'user', 'content': 'How tall is mount rainier?'}\n",
      "{'role': 'assistant', 'function_call': {'name': 'search_bing', 'arguments': '{\\n  \"query\": \"height of Mount Rainier\"\\n}'}, 'content': None}\n",
      "{'role': 'function', 'name': 'search_bing', 'content': '[{\"title\": \"Mount Rainier - Wikipedia\", \"link\": \"https://en.wikipedia.org/wiki/Mount_Rainier\", \"snippet\": \"Coordinates: 46\\\\u00b051\\\\u203210\\\\u2033N 121\\\\u00b045\\\\u203238\\\\u2033W Mount Rainier seen from the International Space Station Mount Rainier ( / re\\\\u026a\\\\u02c8n\\\\u026a\\\\u0259r / ray-NEER ), also known as Tahoma, is a large active stratovolcano in the Cascade Range of the Pacific Northwest in the United States.\"}, {\"title\": \"Geology and History Summary for Mount Rainier - USGS.gov\", \"link\": \"https://www.usgs.gov/volcanoes/mount-rainier/geology-and-history-summary-mount-rainier\", \"snippet\": \"Public domain.) Mount Rainier is an active volcano of the Cascade Range in Washington State, 50-70 km (30-44 mi) southeast of the Seattle\\\\u2013Tacoma metropolitan area. Volcanism occurs at Mount Rainier and other Cascades arc volcanoes because of the subduction of the Juan de Fuca Plate off the western coast of North America.\"}, {\"title\": \"Mount Rainier | U.S. Geological Survey - USGS.gov\", \"link\": \"https://www.usgs.gov/volcanoes/mount-rainier\", \"snippet\": \"Mount Rainier, the highest peak in the Cascade Range at 4,392m (14,410 ft), forms a dramatic backdrop to the Puget Sound region. Summary During an eruption 5,600 years ago the once-higher edifice of Mount Rainier collapsed to form a large crater open to the northeast much like that at Mount St. Helens after 1980.\"}, {\"title\": \"Mount Rainier | National Park, History, Eruptions, & Map\", \"link\": \"https://www.britannica.com/place/Mount-Rainier\", \"snippet\": \"Mount Rainier, highest mountain (14,410 feet [4,392 meters]) in the state of Washington, U.S., and in the Cascade Range. It lies about 40 miles (64 km) southeast of the city of Tacoma, within Mount Rainier National Park. A dormant volcano, it last erupted about 150 years ago.\"}, {\"title\": \"Mount Rainier National Park - Wikipedia\", \"link\": \"https://en.wikipedia.org/wiki/Mount_Rainier_National_Park\", \"snippet\": \"The highest point in the Cascade Range, Mount Rainier is surrounded by valleys, waterfalls, subalpine meadows, and 91,000 acres (142.2 sq mi; 368.3 km 2) of old-growth forest. [4] More than 25 glaciers descend the flanks of the volcano, which is often shrouded in clouds that dump enormous amounts of rain and snow.\"}, {\"title\": \"Mount Rainier National Park (U.S. National Park Service)\", \"link\": \"https://www.nps.gov/mora/index.htm\", \"snippet\": \"Ascending to 14,410 feet above sea level, Mount Rainier stands as an icon in the Washington landscape. An active volcano, Mount Rainier is the most glaciated peak in the contiguous U.S.A., spawning five major rivers. Subalpine wildflower meadows ring the icy volcano while ancient forest cloaks Mount Rainier\\\\u2019s lower slopes.\"}, {\"title\": \"Mount Rainier Geology | U.S. Geological Survey - USGS.gov\", \"link\": \"https://www.usgs.gov/geology-and-ecology-of-national-parks/mount-rainier-geology\", \"snippet\": \"Mt. Rainier is an active volcano, rising to over 14,000 feet southeast of Seattle. Return to Rainier main page Sources/Usage: Public Domain. A distant view of Mount Rainier volcano over Puyallup Valley, near Orting, Washington.\"}, {\"title\": \"Mount Rainier is a special place - U.S. National Park Service\", \"link\": \"https://www.nps.gov/mora/learn/management/what-s-special.htm\", \"snippet\": \"At a height of 14,410 feet, Mount Rainier is the highest volcanic peak in the contiguous United States. It has the largest alpine glacial system outside of Alaska and the world\\'s largest volcanic glacier cave system (in the summit crater).\"}, {\"title\": \"Frequently Asked Questions - Mount Rainier National Park (U.S. National ...\", \"link\": \"https://www.nps.gov/mora/faqs.htm\", \"snippet\": \"Mount Rainier National Park encompasses 236,380.89 acres or 369.34 square miles within the legislative park boundary, with an additional 140 acres lying outside the boundary. Of that amount, 228,480 acres (97% of the park) has been designated by Congress as Wilderness. The park is also a National Historic Landmark District.\"}]'}\n",
      "\n",
      "Final response:\n",
      "Mount Rainier, also known as Tahoma, is the highest peak in the Cascade Range and is located in Washington State, United States. It stands at a height of 14,410 feet (4,392 meters) above sea level. Mount Rainier is an active stratovolcano and is surrounded by valleys, waterfalls, subalpine meadows, and old-growth forests. It is also the most glaciated peak in the contiguous United States, with more than 25 glaciers descending its flanks.\n"
     ]
    }
   ],
   "source": [
    "system_message = \"\"\"You are an assistant designed to help people answer questions.\n",
    "\n",
    "You have access to query the web using Bing Search. You should call bing search whenever a question requires up to date information or could benefit from web data.\n",
    "\"\"\"\n",
    "\n",
    "messages = [{\"role\": \"system\", \"content\": system_message},\n",
    "            {\"role\": \"user\", \"content\": \"How tall is mount rainier?\"}]\n",
    "\n",
    "\n",
    "available_functions = {'search_bing': search}\n",
    "\n",
    "result = run_multiturn_conversation(messages, tools, available_functions)\n",
    "\n",
    "print(\"Final response:\")\n",
    "print(result.choices[0].message)"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## Next steps\n",
    "\n",
    "The example above shows a simple pattern for how you can use function calling to ground Azure OpenAI models on data from the web. Here are some ideas for how you could extend this example:\n",
    "\n",
    "- Teach the model to cite its sources using prompt engineering\n",
    "- Define a second function to click into the top search result and extract relevant details from the page. To limit the length of text from the website, you could consider using a separate prompt to summarize the text relevant to the user's query before adding it to the conversation history\n",
    "- Integrate your own data sources using additional functions"
   ]
  }
 ],
 "metadata": {
  "kernelspec": {
   "display_name": "Python 3",
   "language": "python",
   "name": "python3"
  },
  "language_info": {
   "codemirror_mode": {
    "name": "ipython",
    "version": 3
   },
   "file_extension": ".py",
   "mimetype": "text/x-python",
   "name": "python",
   "nbconvert_exporter": "python",
   "pygments_lexer": "ipython3",
   "version": "3.10.11"
  },
  "orig_nbformat": 4
 },
 "nbformat": 4,
 "nbformat_minor": 2
}
   ```

#### **With User's API Key (OpenAI Websearch Tool)**
*   **Link:** [`tools-web-search?api-mode=responses`](https://platform.openai.com/docs/guides/tools-web-search?api-mode=responses)
*   **Content (Key Concepts):**
    ```
        Web search
==========

Allow models to search the web for the latest information before generating a response.

Using the [Responses API](/docs/api-reference/responses), you can enable web search by configuring it in the `tools` array in an API request to generate content. Like any other tool, the model can choose to search the web or not based on the content of the input prompt.

Web search tool example

```javascript
import OpenAI from "openai";
const client = new OpenAI();

const response = await client.responses.create({
    model: "gpt-4.1",
    tools: [ { type: "web_search_preview" } ],
    input: "What was a positive news story from today?",
});

console.log(response.output_text);
```

```python
from openai import OpenAI
client = OpenAI()

response = client.responses.create(
    model="gpt-4.1",
    tools=[{"type": "web_search_preview"}],
    input="What was a positive news story from today?"
)

print(response.output_text)
```

```bash
curl "https://api.openai.com/v1/responses" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $OPENAI_API_KEY" \
    -d '{
        "model": "gpt-4.1",
        "tools": [{"type": "web_search_preview"}],
        "input": "what was a positive news story from today?"
    }'
```

Web search tool versions

The current default version of the web search tool is:

`web_search_preview`

Which points to a dated version:

`web_search_preview_2025_03_11`

As the tool evolves, future dated snapshot versions will be documented in the [API reference](/docs/api-reference/responses/create).

You can also force the use of the `web_search_preview` tool by using the `tool_choice` parameter, and setting it to `{type: "web_search_preview"}` - this can help ensure lower latency and more consistent results.

Output and citations
--------------------

Model responses that use the web search tool will include two parts:

*   A `web_search_call` output item with the ID of the search call.
*   A `message` output item containing:
    *   The text result in `message.content[0].text`
    *   Annotations `message.content[0].annotations` for the cited URLs

By default, the model's response will include inline citations for URLs found in the web search results. In addition to this, the `url_citation` annotation object will contain the URL, title and location of the cited source.

When displaying web results or information contained in web results to end users, inline citations must be made clearly visible and clickable in your user interface.

```json
[
  {
    "type": "web_search_call",
    "id": "ws_67c9fa0502748190b7dd390736892e100be649c1a5ff9609",
    "status": "completed"
  },
  {
    "id": "msg_67c9fa077e288190af08fdffda2e34f20be649c1a5ff9609",
    "type": "message",
    "status": "completed",
    "role": "assistant",
    "content": [
      {
        "type": "output_text",
        "text": "On March 6, 2025, several news...",
        "annotations": [
          {
            "type": "url_citation",
            "start_index": 2606,
            "end_index": 2758,
            "url": "https://...",
            "title": "Title..."
          }
        ]
      }
    ]
  }
]
```

User location
-------------

To refine search results based on geography, you can specify an approximate user location using country, city, region, and/or timezone.

*   The `city` and `region` fields are free text strings, like `Minneapolis` and `Minnesota` respectively.
*   The `country` field is a two-letter [ISO country code](https://en.wikipedia.org/wiki/ISO_3166-1), like `US`.
*   The `timezone` field is an [IANA timezone](https://timeapi.io/documentation/iana-timezones) like `America/Chicago`.

Customizing user location

```python
from openai import OpenAI
client = OpenAI()

response = client.responses.create(
    model="gpt-4.1",
    tools=[{
        "type": "web_search_preview",
        "user_location": {
            "type": "approximate",
            "country": "GB",
            "city": "London",
            "region": "London",
        }
    }],
    input="What are the best restaurants around Granary Square?",
)

print(response.output_text)
```

```javascript
import OpenAI from "openai";
const openai = new OpenAI();

const response = await openai.responses.create({
    model: "gpt-4.1",
    tools: [{
        type: "web_search_preview",
        user_location: {
            type: "approximate",
            country: "GB",
            city: "London",
            region: "London"
        }
    }],
    input: "What are the best restaurants around Granary Square?",
});
console.log(response.output_text);
```

```bash
curl "https://api.openai.com/v1/responses" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $OPENAI_API_KEY" \
    -d '{
        "model": "gpt-4.1",
        "tools": [{
            "type": "web_search_preview",
            "user_location": {
                "type": "approximate",
                "country": "GB",
                "city": "London",
                "region": "London"
            }
        }],
        "input": "What are the best restaurants around Granary Square?"
    }'
```

Search context size
-------------------

When using this tool, the `search_context_size` parameter controls how much context is retrieved from the web to help the tool formulate a response. The tokens used by the search tool do **not** affect the context window of the main model specified in the `model` parameter in your response creation request. These tokens are also **not** carried over from one turn to another — they're simply used to formulate the tool response and then discarded.

Choosing a context size impacts:

*   **Cost**: Pricing of our search tool varies based on the value of this parameter. Higher context sizes are more expensive. See tool pricing [here](/docs/pricing).
*   **Quality**: Higher search context sizes generally provide richer context, resulting in more accurate, comprehensive answers.
*   **Latency**: Higher context sizes require processing more tokens, which can slow down the tool's response time.

Available values:

*   **`high`**: Most comprehensive context, highest cost, slower response.
*   **`medium`** (default): Balanced context, cost, and latency.
*   **`low`**: Least context, lowest cost, fastest response, but potentially lower answer quality.

Again, tokens used by the search tool do **not** impact main model's token usage and are not carried over from turn to turn. Check the [pricing page](/docs/pricing) for details on costs associated with each context size.

Customizing search context size

```python
from openai import OpenAI
client = OpenAI()

response = client.responses.create(
    model="gpt-4.1",
    tools=[{
        "type": "web_search_preview",
        "search_context_size": "low",
    }],
    input="What movie won best picture in 2025?",
)

print(response.output_text)
```

```javascript
import OpenAI from "openai";
const openai = new OpenAI();

const response = await openai.responses.create({
    model: "gpt-4.1",
    tools: [{
        type: "web_search_preview",
        search_context_size: "low",
    }],
    input: "What movie won best picture in 2025?",
});
console.log(response.output_text);
```

```bash
curl "https://api.openai.com/v1/responses" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $OPENAI_API_KEY" \
    -d '{
        "model": "gpt-4.1",
        "tools": [{
            "type": "web_search_preview",
            "search_context_size": "low"
        }],
        "input": "What movie won best picture in 2025?"
    }'
```

Usage notes
-----------

||
|ResponsesChat CompletionsAssistants|Same as tiered rate limits for underlying model used with the tool.|PricingZDR and data residency|

#### Limitations

*   Web search is currently not supported in the [`gpt-4.1-nano`](/docs/models/gpt-4.1-nano) model.
*   The [`gpt-4o-search-preview`](/docs/models/gpt-4o-search-preview) and [`gpt-4o-mini-search-preview`](/docs/models/gpt-4o-mini-search-preview) models used in Chat Completions only support a subset of API parameters - view their model data pages for specific information on rate limits and feature support.
*   When used as a tool in the [Responses API](/docs/api-reference/responses), web search has the same tiered rate limits as the models above.
*   Web search is limited to a context window size of 128000 (even with [`gpt-4.1`](/docs/models/gpt-4.1) and [`gpt-4.1-mini`](/docs/models/gpt-4.1-mini) models).
*   [Refer to this guide](/docs/guides/your-data) for data handling, residency, and retention information.
    ```

### **Note: Structured JSON/JSON Mode**
*   **Note:** Example shown for completions api, remember we using responses api. Example uses microsoft entra id for auth, but we should stick to our api key auth method.
*   **Link:** [`structured-outputs?tabs=python%2Cdotnet-entra-id&pivots=programming-language-python`](https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/structured-outputs?tabs=python%2Cdotnet-entra-id&pivots=programming-language-python)
*   **Content (Key Concepts for Responses API):**
    ```
    Structured outputs
04/16/2025
Choose a language or API
Structured outputs make a model follow a JSON Schema definition that you provide as part of your inference API call. This is in contrast to the older JSON mode feature, which guaranteed valid JSON would be generated, but was unable to ensure strict adherence to the supplied schema. Structured outputs are recommended for function calling, extracting structured data, and building complex multi-step workflows.

 Note

Currently structured outputs are not supported with:

Bring your own data scenarios.
Assistants or Azure AI Agents Service.
gpt-4o-audio-preview and gpt-4o-mini-audio-preview version: 2024-12-17.
Supported models
gpt-4.5-preview version 2025-02-27
o3-mini version 2025-01-31
o1 version: 2024-12-17
gpt-4o-mini version: 2024-07-18
gpt-4o version: 2024-08-06
gpt-4o version: 2024-11-20
gpt-4.1 version 2025-04-14
gpt-4.1-nano version 2025-04-14
gpt-4.1-mini version: 2025-04-14
o4-mini version: 2025-04-16
o3 version: 2025-04-16
API support
Support for structured outputs was first added in API version 2024-08-01-preview. It is available in the latest preview APIs as well as the latest GA API: 2024-10-21.

Getting started
Python (Microsoft Entra ID)
Python (key-based auth)
You can use Pydantic to define object schemas in Python. Depending on what version of the OpenAI and Pydantic libraries you're running you might need to upgrade to a newer version. These examples were tested against openai 1.42.0 and pydantic 2.8.2.

Windows Command Prompt

Copy
pip install openai pydantic --upgrade
Python

Copy
import os
from pydantic import BaseModel
from openai import AzureOpenAI

client = AzureOpenAI(
  azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT"), 
  api_key=os.getenv("AZURE_OPENAI_API_KEY"),  
  api_version="2024-10-21"
)


class CalendarEvent(BaseModel):
    name: str
    date: str
    participants: list[str]

completion = client.beta.chat.completions.parse(
    model="MODEL_DEPLOYMENT_NAME", # replace with the model deployment name of your gpt-4o 2024-08-06 deployment
    messages=[
        {"role": "system", "content": "Extract the event information."},
        {"role": "user", "content": "Alice and Bob are going to a science fair on Friday."},
    ],
    response_format=CalendarEvent,
)

event = completion.choices[0].message.parsed

print(event)
print(completion.model_dump_json(indent=2))
Output
JSON

Copy
name='Science Fair' date='Friday' participants=['Alice', 'Bob']
{
  "id": "chatcmpl-A1EUP2fAmL4SeB1lVMinwM7I2vcqG",
  "choices": [
    {
      "finish_reason": "stop",
      "index": 0,
      "logprobs": null,
      "message": {
        "content": "{\n  \"name\": \"Science Fair\",\n  \"date\": \"Friday\",\n  \"participants\": [\"Alice\", \"Bob\"]\n}",
        "refusal": null,
        "role": "assistant",
        "function_call": null,
        "tool_calls": [],
        "parsed": {
          "name": "Science Fair",
          "date": "Friday",
          "participants": [
            "Alice",
            "Bob"
          ]
        }
      }
    }
  ],
  "created": 1724857389,
  "model": "gpt-4o-2024-08-06",
  "object": "chat.completion",
  "service_tier": null,
  "system_fingerprint": "fp_1c2eaec9fe",
  "usage": {
    "completion_tokens": 27,
    "prompt_tokens": 32,
    "total_tokens": 59
  }
}
Function calling with structured outputs
Structured Outputs for function calling can be enabled with a single parameter, by supplying strict: true.

 Note

Structured outputs are not supported with parallel function calls. When using structured outputs set parallel_tool_calls to false.

Python (Microsoft Entra ID)
Python (key-based auth)
Python

Copy
from enum import Enum
from typing import Union
from pydantic import BaseModel
import openai
from openai import AzureOpenAI

client = AzureOpenAI(
  azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT"), 
  api_key=os.getenv("AZURE_OPENAI_API_KEY"),  
  api_version="2024-10-21"
)

class GetDeliveryDate(BaseModel):
    order_id: str

tools = [openai.pydantic_function_tool(GetDeliveryDate)]

messages = []
messages.append({"role": "system", "content": "You are a helpful customer support assistant. Use the supplied tools to assist the user."})
messages.append({"role": "user", "content": "Hi, can you tell me the delivery date for my order #12345?"}) 

response = client.chat.completions.create(
    model="MODEL_DEPLOYMENT_NAME", # replace with the model deployment name of your gpt-4o 2024-08-06 deployment
    messages=messages,
    tools=tools
)

print(response.choices[0].message.tool_calls[0].function)
print(response.model_dump_json(indent=2))
Supported schemas and limitations
Azure OpenAI structured outputs support the same subset of the JSON Schema as OpenAI.

Supported types
String
Number
Boolean
Integer
Object
Array
Enum
anyOf
 Note

Root objects cannot be the anyOf type.

All fields must be required
All fields or function parameters must be included as required. In the example below location, and unit are both specified under "required": ["location", "unit"].

JSON

Copy
{
    "name": "get_weather",
    "description": "Fetches the weather in the given location",
    "strict": true,
    "parameters": {
        "type": "object",
        "properties": {
            "location": {
                "type": "string",
                "description": "The location to get the weather for"
            },
            "unit": {
                "type": "string",
                "description": "The unit to return the temperature in",
                "enum": ["F", "C"]
            }
        },
        "additionalProperties": false,
        "required": ["location", "unit"]
    }
If needed, it's possible to emulate an optional parameter by using a union type with null. In this example, this is achieved with the line "type": ["string", "null"],.

JSON

Copy
{
    "name": "get_weather",
    "description": "Fetches the weather in the given location",
    "strict": true,
    "parameters": {
        "type": "object",
        "properties": {
            "location": {
                "type": "string",
                "description": "The location to get the weather for"
            },
            "unit": {
                "type": ["string", "null"],
                "description": "The unit to return the temperature in",
                "enum": ["F", "C"]
            }
        },
        "additionalProperties": false,
        "required": [
            "location", "unit"
        ]
    }
}
Nesting depth
A schema may have up to 100 object properties total, with up to five levels of nesting

additionalProperties: false must always be set in objects
This property controls if an object can have additional key value pairs that weren't defined in the JSON Schema. In order to use structured outputs, you must set this value to false.

Key ordering
Structured outputs are ordered the same as the provided schema. To change the output order, modify the order of the schema that you send as part of your inference request.

Unsupported type-specific keywords
Type	Unsupported Keyword
String	minlength
maxLength
pattern
format
Number	minimum
maximum
multipleOf
Objects	patternProperties
unevaluatedProperties
propertyNames
minProperties
maxProperties
Arrays	unevaluatedItems
contains
minContains
maxContains
minItems
maxItems
uniqueItems
Nested schemas using anyOf must adhere to the overall JSON Schema subset
Example supported anyOf schema:

JSON

Copy
{
    "type": "object",
    "properties": {
        "item": {
            "anyOf": [
                {
                    "type": "object",
                    "description": "The user object to insert into the database",
                    "properties": {
                        "name": {
                            "type": "string",
                            "description": "The name of the user"
                        },
                        "age": {
                            "type": "number",
                            "description": "The age of the user"
                        }
                    },
                    "additionalProperties": false,
                    "required": [
                        "name",
                        "age"
                    ]
                },
                {
                    "type": "object",
                    "description": "The address object to insert into the database",
                    "properties": {
                        "number": {
                            "type": "string",
                            "description": "The number of the address. Eg. for 123 main st, this would be 123"
                        },
                        "street": {
                            "type": "string",
                            "description": "The street name. Eg. for 123 main st, this would be main st"
                        },
                        "city": {
                            "type": "string",
                            "description": "The city of the address"
                        }
                    },
                    "additionalProperties": false,
                    "required": [
                        "number",
                        "street",
                        "city"
                    ]
                }
            ]
        }
    },
    "additionalProperties": false,
    "required": [
        "item"
    ]
}
Definitions are supported
Supported example:

JSON

Copy
{
    "type": "object",
    "properties": {
        "steps": {
            "type": "array",
            "items": {
                "$ref": "#/$defs/step"
            }
        },
        "final_answer": {
            "type": "string"
        }
    },
    "$defs": {
        "step": {
            "type": "object",
            "properties": {
                "explanation": {
                    "type": "string"
                },
                "output": {
                    "type": "string"
                }
            },
            "required": [
                "explanation",
                "output"
            ],
            "additionalProperties": false
        }
    },
    "required": [
        "steps",
        "final_answer"
    ],
    "additionalProperties": false
}
Recursive schemas are supported
Example using # for root recursion:

JSON

Copy
{
        "name": "ui",
        "description": "Dynamically generated UI",
        "strict": true,
        "schema": {
            "type": "object",
            "properties": {
                "type": {
                    "type": "string",
                    "description": "The type of the UI component",
                    "enum": ["div", "button", "header", "section", "field", "form"]
                },
                "label": {
                    "type": "string",
                    "description": "The label of the UI component, used for buttons or form fields"
                },
                "children": {
                    "type": "array",
                    "description": "Nested UI components",
                    "items": {
                        "$ref": "#"
                    }
                },
                "attributes": {
                    "type": "array",
                    "description": "Arbitrary attributes for the UI component, suitable for any element",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {
                                "type": "string",
                                "description": "The name of the attribute, for example onClick or className"
                            },
                            "value": {
                                "type": "string",
                                "description": "The value of the attribute"
                            }
                        },
                      "additionalProperties": false,
                      "required": ["name", "value"]
                    }
                }
            },
            "required": ["type", "label", "children", "attributes"],
            "additionalProperties": false
        }
    }
Example of explicit recursion:

JSON

Copy
{
    "type": "object",
    "properties": {
        "linked_list": {
            "$ref": "#/$defs/linked_list_node"
        }
    },
    "$defs": {
        "linked_list_node": {
            "type": "object",
            "properties": {
                "value": {
                    "type": "number"
                },
                "next": {
                    "anyOf": [
                        {
                            "$ref": "#/$defs/linked_list_node"
                        },
                        {
                            "type": "null"
                        }
                    ]
                }
            },
            "additionalProperties": false,
            "required": [
                "next",
                "value"
            ]
        }
    },
    "additionalProperties": false,
    "required": [
        "linked_list"
    ]
}

    ```

### **Note: Image Generation**
*   **Note:** Snippet below from the responses api docs
```
Image generation
The Responses API enables image generation as part of conversations and multi-step workflows. It supports image inputs and outputs within context and includes built-in tools for generating and editing images.

Compared to the standalone Image API, the Responses API offers several advantages:

Multi-turn editing: Iteratively refine and edit images using natural language prompts.
Streaming: Display partial image outputs during generation to improve perceived latency.
Flexible inputs: Accept image File IDs as inputs, in addition to raw image bytes.
 Note

The image generation tool in the Responses API is only supported by the gpt-image-1 model. You can however call this model from this list of supported models - gpt-4o, gpt-4o-mini, gpt-4.1, gpt-4.1-mini, gpt-4.1-nano, o3.

Use the Responses API if you want to:

Build conversational image experiences with GPT Image.
Enable iterative image editing through multi-turn prompts.
Stream partial image results during generation for a smoother user experience.
Generate an image

Python

Copy
from openai import AzureOpenAI
from azure.identity import DefaultAzureCredential, get_bearer_token_provider

token_provider = get_bearer_token_provider(
    DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
)

client = AzureOpenAI(  
  base_url = "https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/",  
  azure_ad_token_provider=token_provider,
  api_version="preview",
  default_headers={"x-ms-oai-image-generation-deployment":"YOUR-GPT-IMAGE1-DEPLOYMENT-NAME"}
)

response = client.responses.create(
    model="o3",
    input="Generate an image of gray tabby cat hugging an otter with an orange scarf",
    tools=[{"type": "image_generation"}],
)

# Save the image to a file
image_data = [
    output.result
    for output in response.output
    if output.type == "image_generation_call"
]
    
if image_data:
    image_base64 = image_data[0]
    with open("otter.png", "wb") as f:
        f.write(base64.b64decode(image_base64))
You can perform multi-turn image generation by using the output of image generation in subsequent calls or just using the 1previous_response_id.

Python

Copy
from openai import AzureOpenAI
from azure.identity import DefaultAzureCredential, get_bearer_token_provider

token_provider = get_bearer_token_provider(
    DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
)

client = AzureOpenAI(  
  base_url = "https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/",  
  azure_ad_token_provider=token_provider,
  api_version="preview",
  default_headers={"x-ms-oai-image-generation-deployment":"YOUR-GPT-IMAGE1-DEPLOYMENT-NAME"}
)

image_data = [
    output.result
    for output in response.output
    if output.type == "image_generation_call"
]

if image_data:
    image_base64 = image_data[0]

    with open("cat_and_otter.png", "wb") as f:
        f.write(base64.b64decode(image_base64))


# Follow up

response_followup = client.responses.create(
    model="gpt-4.1-mini",
    previous_response_id=response.id,
    input="Now make it look realistic",
    tools=[{"type": "image_generation"}],
)

image_data_followup = [
    output.result
    for output in response_followup.output
    if output.type == "image_generation_call"
]

if image_data_followup:
    image_base64 = image_data_followup[0]
    with open("cat_and_otter_realistic.png", "wb") as f:
        f.write(base64.b64decode(image_base64))
Streaming
You can stream partial images using Responses API. The partial_images can be used to receive 1-3 partial images

Python

Copy
from openai import AzureOpenAI
from azure.identity import DefaultAzureCredential, get_bearer_token_provider

token_provider = get_bearer_token_provider(
    DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
)

client = AzureOpenAI(  
  base_url = "https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/",  
  azure_ad_token_provider=token_provider,
  api_version="preview",
  default_headers={"x-ms-oai-image-generation-deployment":"YOUR-GPT-IMAGE1-DEPLOYMENT-NAME"}
)

stream = client.responses.create(
    model="gpt-4.1",
    input="Draw a gorgeous image of a river made of white owl feathers, snaking its way through a serene winter landscape",
    stream=True,
    tools=[{"type": "image_generation", "partial_images": 2}],
)

for event in stream:
    if event.type == "response.image_generation_call.partial_image":
        idx = event.partial_image_index
        image_base64 = event.partial_image_b64
        image_bytes = base64.b64decode(image_base64)
        with open(f"river{idx}.png", "wb") as f:
            f.write(image_bytes)
Edit images
Python

Copy
from openai import AzureOpenAI
from azure.identity import DefaultAzureCredential, get_bearer_token_provider
import base64

client = AzureOpenAI(  
  base_url = "https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/",  
  azure_ad_token_provider=token_provider,
  api_version="preview",
  default_headers={"x-ms-oai-image-generation-deployment":"YOUR-GPT-IMAGE1-DEPLOYMENT-NAME"}
)

def create_file(file_path):
  with open(file_path, "rb") as file_content:
    result = client.files.create(
        file=file_content,
        purpose="vision",
    )
    return result.id

def encode_image(file_path):
    with open(file_path, "rb") as f:
        base64_image = base64.b64encode(f.read()).decode("utf-8")
    return base64_image

prompt = """Generate a photorealistic image of a gift basket on a white background 
labeled 'Relax & Unwind' with a ribbon and handwriting-like font, 
containing all the items in the reference pictures."""

base64_image1 = encode_image("image1.png")
base64_image2 = encode_image("image2.png")
file_id1 = create_file("image3.png")
file_id2 = create_file("image4.png")

response = client.responses.create(
    model="gpt-4.1",
    input=[
        {
            "role": "user",
            "content": [
                {"type": "input_text", "text": prompt},
                {
                    "type": "input_image",
                    "image_url": f"data:image/jpeg;base64,{base64_image1}",
                },
                {
                    "type": "input_image",
                    "image_url": f"data:image/jpeg;base64,{base64_image2}",
                },
                {
                    "type": "input_image",
                    "file_id": file_id1,
                },
                {
                    "type": "input_image",
                    "file_id": file_id2,
                }
            ],
        }
    ],
    tools=[{"type": "image_generation"}],
)

image_generation_calls = [
    output
    for output in response.output
    if output.type == "image_generation_call"
]

image_data = [output.result for output in image_generation_calls]

if image_data:
    image_base64 = image_data[0]
    with open("gift-basket.png", "wb") as f:
        f.write(base64.b64decode(image_base64))
else:
    print(response.output.content)
```

### **Note: Video Generation**
*   **Link:** [`video-generation-quickstart?tabs=windows%2Capi-key`](https://learn.microsoft.com/en-us/azure/ai-services/openai/video-generation-quickstart?tabs=windows%2Capi-key)
*   **Content (Key Concepts):**
    ```
    Quickstart: Generate a video with Sora (preview)
05/29/2025
In this quickstart, you generate video clips using the Azure OpenAI service. The example uses the Sora model, which is a video generation model that creates realistic and imaginative video scenes from text instructions. This guide shows you how to create a video generation job, poll for its status, and retrieve the generated video.

For more information on video generation, see Video generation concepts.

Prerequisites
An Azure subscription. Create one for free.
Python 3.8 or later version. We recommend using Python 3.10 or later, but having at least Python 3.8 is required. If you don't have a suitable version of Python installed, you can follow the instructions in the VS Code Python Tutorial for the easiest way of installing Python on your operating system.
An Azure OpenAI resource created in one of the supported regions. For more information about region availability, see the models and versions documentation.
Then, you need to deploy a sora model with your Azure OpenAI resource. For more information, see Create a resource and deploy a model with Azure OpenAI.
Microsoft Entra ID prerequisites
For the recommended keyless authentication with Microsoft Entra ID, you need to:

Install the Azure CLI used for keyless authentication with Microsoft Entra ID.
Assign the Cognitive Services User role to your user account. You can assign roles in the Azure portal under Access control (IAM) > Add role assignment.
Set up
Create a new folder video-generation-quickstart and go to the quickstart folder with the following command:

shell

Copy
mkdir video-generation-quickstart && cd video-generation-quickstart
Create a virtual environment. If you already have Python 3.10 or higher installed, you can create a virtual environment using the following commands:

Windows
Linux
macOS
Bash

Copy
py -3 -m venv .venv
.venv\scripts\activate
Activating the Python environment means that when you run python or pip from the command line, you then use the Python interpreter contained in the .venv folder of your application. You can use the deactivate command to exit the python virtual environment, and can later reactivate it when needed.

 Tip

We recommend that you create and activate a new Python environment to use to install the packages you need for this tutorial. Don't install packages into your global python installation. You should always use a virtual or conda environment when installing python packages, otherwise you can break your global installation of Python.

For the recommended keyless authentication with Microsoft Entra ID, install the azure-identity package with:

Console

Copy
pip install azure-identity
Retrieve resource information
You need to retrieve the following information to authenticate your application with your Azure OpenAI resource:

Microsoft Entra ID
API key
Variable name	Value
AZURE_OPENAI_ENDPOINT	This value can be found in the Keys and Endpoint section when examining your resource from the Azure portal.
AZURE_OPENAI_API_KEY	This value can be found in the Keys and Endpoint section when examining your resource from the Azure portal. You can use either KEY1 or KEY2.
AZURE_OPENAI_DEPLOYMENT_NAME	This value will correspond to the custom name you chose for your deployment when you deployed a model. This value can be found under Resource Management > Model Deployments in the Azure portal.
OPENAI_API_VERSION	Learn more about API Versions.
Learn more about finding API keys and setting environment variables.

 Important

Use API keys with caution. Don't include the API key directly in your code, and never post it publicly. If you use an API key, store it securely in Azure Key Vault. For more information about using API keys securely in your apps, see API keys with Azure Key Vault.

For more information about AI services security, see Authenticate requests to Azure AI services.

Generate video with Sora
You can generate a video with the Sora model by creating a video generation job, polling for its status, and retrieving the generated video. The following code shows how to do this via the REST API using Python.

Microsoft Entra ID
API key
Create the sora-quickstart.py file with the following code:

Python

Copy
import requests
import base64 
import os

# Set environment variables or edit the corresponding values here.
endpoint = os.environ['AZURE_OPENAI_ENDPOINT']
api_key = os.environ['AZURE_OPENAI_API_KEY']

api_version = 'preview'
headers= { "api-key": api_key, "Content-Type": "application/json" }

# 1. Create a video generation job
create_url = f"{endpoint}/openai/v1/video/generations/jobs?api-version={api_version}"
body = {
    "prompt": "A cat playing piano in a jazz bar.",
    "width": 480,
    "height": 480,
    "n_seconds": 5,
    "model": "sora"
}
response = requests.post(create_url, headers=headers, json=body)
response.raise_for_status()
print("Full response JSON:", response.json())
job_id = response.json()["id"]
print(f"Job created: {job_id}")

# 2. Poll for job status
status_url = f"{endpoint}/openai/v1/video/generations/jobs/{job_id}?api-version={api_version}"
status=None
while status not in ("succeeded", "failed", "cancelled"):
    time.sleep(5)  # Wait before polling again
    status_response = requests.get(status_url, headers=headers).json()
    status = status_response.get("status")
    print(f"Job status: {status}")

# 3. Retrieve generated video 
if status == "succeeded":
    generations = status_response.get("generations", [])
    if generations:
        print(f"✅ Video generation succeeded.")
        generation_id = generations[0].get("id")
        video_url = f"{endpoint}/openai/v1/video/generations/{generation_id}/content/video?api-version={api_version}"
        video_response = requests.get(video_url, headers=headers)
        if video_response.ok:
            output_filename = "output.mp4"
            with open(output_filename, "wb") as file:
                file.write(video_response.content)
                print(f'Generated video saved as "{output_filename}"')
    else:
        raise Exception("No generations found in job result.")
else:
    raise Exception(f"Job didn't succeed. Status: {status}")
Run the Python file.

shell

Copy
python sora-quickstart.py
Wait a few moments to get the response.

Output
The output will show the full response JSON from the video generation job creation request, including the job ID and status.

JSON

Copy
```json
{
    "object": "video.generation.job",
    "id": "task_01jwcet0eje35tc5jy54yjax5q",
    "status": "queued",
    "created_at": 1748469875,
    "finished_at": null,
    "expires_at": null,
    "generations": [],
    "prompt": "A cat playing piano in a jazz bar.",
    "model": "sora",
    "n_variants": 1,
    "n_seconds": 5,
    "height": 480,
    "width": 480,
    "failure_reason": null
}
The generated video will be saved as output.mp4 in the current directory.

text

Copy
Job created: task_01jwcet0eje35tc5jy54yjax5q
Job status: preprocessing
Job status: running
Job status: processing
Job status: succeeded
✅ Video generation succeeded.
Generated video saved as "output.mp4"
    ```

### **Note: Live Chat**
*   **Link 1:** [`realtime-audio-webrtc`](https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/realtime-audio-webrtc)
*   **Content (Key Concepts):**
    ```
    How to use the GPT-4o Realtime API via WebRTC (Preview)
06/07/2025
 Note

This feature is currently in public preview. This preview is provided without a service-level agreement, and we don't recommend it for production workloads. Certain features might not be supported or might have constrained capabilities. For more information, see Supplemental Terms of Use for Microsoft Azure Previews.

Azure OpenAI GPT-4o Realtime API for speech and audio is part of the GPT-4o model family that supports low-latency, "speech in, speech out" conversational interactions.

You can use the Realtime API via WebRTC or WebSocket to send audio input to the model and receive audio responses in real time. Follow the instructions in this article to get started with the Realtime API via WebRTC.

In most cases, we recommend using the WebRTC API for real-time audio streaming. The WebRTC API is a web standard that enables real-time communication (RTC) between browsers and mobile applications. Here are some reasons why WebRTC is preferred for real-time audio streaming:

Lower Latency: WebRTC is designed to minimize delay, making it more suitable for audio and video communication where low latency is critical for maintaining quality and synchronization.
Media Handling: WebRTC has built-in support for audio and video codecs, providing optimized handling of media streams.
Error Correction: WebRTC includes mechanisms for handling packet loss and jitter, which are essential for maintaining the quality of audio streams over unpredictable networks.
Peer-to-Peer Communication: WebRTC allows direct communication between clients, reducing the need for a central server to relay audio data, which can further reduce latency.
Use the Realtime API via WebSockets if you need to stream audio data from a server to a client, or if you need to send and receive data in real time between a client and server. WebSockets aren't recommended for real-time audio streaming because they have higher latency than WebRTC.

Supported models
The GPT 4o real-time models are available for global deployments in East US 2 and Sweden Central regions.

gpt-4o-mini-realtime-preview (2024-12-17)
gpt-4o-realtime-preview (2024-12-17)
You should use API version 2025-04-01-preview in the URL for the Realtime API. The API version is included in the sessions URL.

For more information about supported models, see the models and versions documentation.

Prerequisites
Before you can use GPT-4o real-time audio, you need:

An Azure subscription - Create one for free.
An Azure OpenAI resource created in a supported region. For more information, see Create a resource and deploy a model with Azure OpenAI.
You need a deployment of the gpt-4o-realtime-preview or gpt-4o-mini-realtime-preview model in a supported region as described in the supported models section in this article. You can deploy the model from the Azure AI Foundry model catalog or from your project in Azure AI Foundry portal.
Connection and authentication
You use different URLs to get an ephemeral API key and connect to the Realtime API via WebRTC. The URLs are constructed as follows:

URL	Description
Sessions URL	The /realtime/sessions URL is used to get an ephemeral API key. The sessions URL includes the Azure OpenAI resource URL, deployment name, the /realtime/sessions path, and the API version.

You should use API version 2025-04-01-preview in the URL.

For an example and more information, see the Sessions URL section in this article.
WebRTC URL	The WebRTC URL is used to establish a WebRTC peer connection with the Realtime API. The WebRTC URL includes the region and the realtimeapi-preview.ai.azure.com/v1/realtimertc path.

The supported regions are eastus2 and swedencentral.

For an example and more information, see the Sessions URL section in this article.
Sessions URL
Here's an example of a well-constructed realtime/sessions URL that you use to get an ephemeral API key:

HTTP

Copy
https://YourAzureOpenAIResourceName.openai.azure.com/openai/realtimeapi/sessions?api-version=2025-04-01-preview
WebRTC URL
Make sure the region of the WebRTC URL matches the region of your Azure OpenAI resource.

For example:

If your Azure OpenAI resource is in the swedencentral region, the WebRTC URL should be:
HTTP

Copy
https://swedencentral.realtimeapi-preview.ai.azure.com/v1/realtimertc
If your Azure OpenAI resource is in the eastus2 region, the WebRTC URL should be:
HTTP

Copy
https://eastus2.realtimeapi-preview.ai.azure.com/v1/realtimertc
The sessions URL includes the Azure OpenAI resource URL, deployment name, the /realtime/sessions path, and the API version. The Azure OpenAI resource region isn't part of the sessions URL.

Ephemeral API key
You can use the ephemeral API key to authenticate a WebRTC session with the Realtime API. The ephemeral key is valid for one minute and is used to establish a secure WebRTC connection between the client and the Realtime API.

Here's how the ephemeral API key is used in the Realtime API:

Your client requests an ephemeral API key from your server.

Your server mints the ephemeral API key using the standard API key.

 Warning

Never use the standard API key in a client application. The standard API key should only be used in a secure backend service.

Your server returns the ephemeral API key to your client.

Your client uses the ephemeral API key to authenticate a session with the Realtime API via WebRTC.

You send and receive audio data in real time using the WebRTC peer connection.

The following sequence diagram illustrates the process of minting an ephemeral API key and using it to authenticate a WebRTC session with the Realtime API.

Diagram of the ephemeral API key to WebRTC peer connection sequence.

WebRTC example via HTML and JavaScript
The following code sample demonstrates how to use the GPT-4o Realtime API via WebRTC. The sample uses the WebRTC API to establish a real-time audio connection with the model.

The sample code is an HTML page that allows you to start a session with the GPT-4o Realtime API and send audio input to the model. The model's responses are played back in real-time.

 Warning

The sample code includes the API key hardcoded in the JavaScript. This code isn't recommended for production use. In a production environment, you should use a secure backend service to generate an ephemeral key and return it to the client.

Copy the following code into an HTML file and open it in a web browser:

HTML

Copy
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Azure OpenAI Realtime Session</title>
</head>
<body>
    <h1>Azure OpenAI Realtime Session</h1>
    <p>WARNING: Don't use this code sample in production with the API key hardcoded. Use a protected backend service to call the sessions API and generate the ephemeral key. Then return the ephemeral key to the client.</p>
    <button onclick="StartSession()">Start Session</button>

    <!-- Log container for API messages -->
    <div id="logContainer"></div> 

    <script>

        // Make sure the WebRTC URL region matches the region of your Azure OpenAI resource.
        // For example, if your Azure OpenAI resource is in the swedencentral region,
        // the WebRTC URL should be https://swedencentral.realtimeapi-preview.ai.azure.com/v1/realtimertc.
        // If your Azure OpenAI resource is in the eastus2 region, the WebRTC URL should be https://eastus2.realtimeapi-preview.ai.azure.com/v1/realtimertc.
        const WEBRTC_URL= "https://swedencentral.realtimeapi-preview.ai.azure.com/v1/realtimertc"

        // The SESSIONS_URL includes the Azure OpenAI resource URL,
        // deployment name, the /realtime/sessions path, and the API version.
        // The Azure OpenAI resource region isn't part of the SESSIONS_URL.
        const SESSIONS_URL="https://YourAzureOpenAIResourceName.openai.azure.com/openai/realtimeapi/sessions?api-version=2025-04-01-preview"

        // The API key of the Azure OpenAI resource.
        const API_KEY = "YOUR_API_KEY_HERE"; 

        // The deployment name might not be the same as the model name.
        const DEPLOYMENT = "gpt-4o-mini-realtime-preview"
		const VOICE = "verse"

        async function StartSession() {
            try {

                // WARNING: Don't use this code sample in production
                // with the API key hardcoded. 
                // Use a protected backend service to call the 
                // sessions API and generate the ephemeral key.
                // Then return the ephemeral key to the client.

                const response = await fetch(SESSIONS_URL, {
                    method: "POST",
                    headers: {
                        //"Authorization": `Bearer ${ACCESS_TOKEN}`,
                        "api-key": API_KEY,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: DEPLOYMENT,
                        voice: VOICE
                    })
                });

                if (!response.ok) {
                    throw new Error(`API request failed`);
                }

                const data = await response.json();

                const sessionId = data.id;
                const ephemeralKey = data.client_secret?.value; 
                console.error("Ephemeral key:", ephemeralKey);

                // Mask the ephemeral key in the log message.
                logMessage("Ephemeral Key Received: " + "***");
		        logMessage("WebRTC Session Id = " + sessionId );

                // Set up the WebRTC connection using the ephemeral key.
                init(ephemeralKey); 

            } catch (error) {
                console.error("Error fetching ephemeral key:", error);
                logMessage("Error fetching ephemeral key: " + error.message);
            }
        }

        async function init(ephemeralKey) {

            let peerConnection = new RTCPeerConnection();

            // Set up to play remote audio from the model.
            const audioElement = document.createElement('audio');
            audioElement.autoplay = true;
            document.body.appendChild(audioElement);

            peerConnection.ontrack = (event) => {
                audioElement.srcObject = event.streams[0];
            };

            // Set up data channel for sending and receiving events
            const clientMedia = await navigator.mediaDevices.getUserMedia({ audio: true });
            const audioTrack = clientMedia.getAudioTracks()[0];
            peerConnection.addTrack(audioTrack);

            const dataChannel = peerConnection.createDataChannel('realtime-channel');

            dataChannel.addEventListener('open', () => {
                logMessage('Data channel is open');
                updateSession(dataChannel);
            });

            dataChannel.addEventListener('message', (event) => {
                const realtimeEvent = JSON.parse(event.data); 
                console.log(realtimeEvent); 
                logMessage("Received server event: " + JSON.stringify(realtimeEvent, null, 2));
                if (realtimeEvent.type === "session.update") {
                    const instructions = realtimeEvent.session.instructions;
                    logMessage("Instructions: " + instructions);
                } else if (realtimeEvent.type === "session.error") {
                    logMessage("Error: " + realtimeEvent.error.message);
                } else if (realtimeEvent.type === "session.end") {
                    logMessage("Session ended.");
                }
            });

            dataChannel.addEventListener('close', () => {
                logMessage('Data channel is closed');
            });

	          // Start the session using the Session Description Protocol (SDP)
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);

            const sdpResponse = await fetch(`${WEBRTC_URL}?model=${DEPLOYMENT}`, {
                method: "POST",
                body: offer.sdp,
                headers: {
                    Authorization: `Bearer ${ephemeralKey}`,
                    "Content-Type": "application/sdp",
                },
            });

            const answer = { type: "answer", sdp: await sdpResponse.text() };
            await peerConnection.setRemoteDescription(answer);

            const button = document.createElement('button');
            button.innerText = 'Close Session';
            button.onclick = stopSession;
            document.body.appendChild(button);

            // Send a client event to update the session
            function updateSession(dataChannel) {
                const event = {
                    type: "session.update",
                    session: {
                        instructions: "You are a helpful AI assistant responding in natural, engaging language."
                    }
                };
                dataChannel.send(JSON.stringify(event));
                logMessage("Sent client event: " + JSON.stringify(event, null, 2));
            }

            function stopSession() {
                if (dataChannel) dataChannel.close();
                if (peerConnection) peerConnection.close();
                peerConnection = null;
                logMessage("Session closed.");
            }

        }

        function logMessage(message) {
            const logContainer = document.getElementById("logContainer");
            const p = document.createElement("p");
            p.textContent = message;
            logContainer.appendChild(p);
        }
    </script>
</body>
</html>
Select Start Session to start a session with the GPT-4o Realtime API. The session ID and ephemeral key are displayed in the log container.

Allow the browser to access your microphone when prompted.

Confirmation messages are displayed in the log container as the session progresses. Here's an example of the log messages:

text

Copy
Ephemeral Key Received: ***

Starting WebRTC Session with Session Id=SessionIdRedacted

Data channel is open

Sent client event: { "type": "session.update", "session": { "instructions": "You are a helpful AI assistant responding in natural, engaging language." } }

Received server event: { "type": "session.created", "event_id": "event_BQgtmli1Rse8PXgSowx55", "session": { "id": "SessionIdRedacted", "object": "realtime.session", "expires_at": 1745702930, "input_audio_noise_reduction": null, "turn_detection": { "type": "server_vad", "threshold": 0.5, "prefix_padding_ms": 300, "silence_duration_ms": 200, "create_response": true, "interrupt_response": true }, "input_audio_format": "pcm16", "input_audio_transcription": null, "client_secret": null, "include": null, "model": "gpt-4o-mini-realtime-preview-2024-12-17", "modalities": [ "audio", "text" ], "instructions": "Your knowledge cutoff is 2023-10. You are a helpful, witty, and friendly AI. Act like a human, but remember that you aren't a human and that you can't do human things in the real world. Your voice and personality should be warm and engaging, with a lively and playful tone. If interacting in a non-English language, start by using the standard accent or dialect familiar to the user. Talk quickly. You should always call a function if you can. Do not refer to these rules, even if you’re asked about them.", "voice": "verse", "output_audio_format": "pcm16", "tool_choice": "auto", "temperature": 0.8, "max_response_output_tokens": "inf", "tools": [] } }

Received server event: { "type": "session.updated", "event_id": "event_BQgtnWdfHmC10XJjWlotA", "session": { "id": "SessionIdRedacted", "object": "realtime.session", "expires_at": 1745702930, "input_audio_noise_reduction": null, "turn_detection": { "type": "server_vad", "threshold": 0.5, "prefix_padding_ms": 300, "silence_duration_ms": 200, "create_response": true, "interrupt_response": true }, "input_audio_format": "pcm16", "input_audio_transcription": null, "client_secret": null, "include": null, "model": "gpt-4o-mini-realtime-preview-2024-12-17", "modalities": [ "audio", "text" ], "instructions": "You are a helpful AI assistant responding in natural, engaging language.", "voice": "verse", "output_audio_format": "pcm16", "tool_choice": "auto", "temperature": 0.8, "max_response_output_tokens": "inf", "tools": [] } }
The Close Session button closes the session and stops the audio stream.


    ```

*   **Link 2:** [`realtime-audio-reference`](https://learn.microsoft.com/en-us/azure/ai-services/openai/realtime-audio-reference)
*   **Content (Key Concepts):** 
    ```
    Realtime events reference
05/04/2025
 Note

This feature is currently in public preview. This preview is provided without a service-level agreement, and we don't recommend it for production workloads. Certain features might not be supported or might have constrained capabilities. For more information, see Supplemental Terms of Use for Microsoft Azure Previews.

The Realtime API is a WebSocket-based API that allows you to interact with the Azure OpenAI in real-time.

The Realtime API (via /realtime) is built on the WebSockets API to facilitate fully asynchronous streaming communication between the end user and model. Device details like capturing and rendering audio data are outside the scope of the Realtime API. It should be used in the context of a trusted, intermediate service that manages both connections to end users and model endpoint connections. Don't use it directly from untrusted end user devices.

 Tip

To get started with the Realtime API, see the quickstart and how-to guide.

Client events
There are nine client events that can be sent from the client to the server:

Event	Description
RealtimeClientEventConversationItemCreate	The client conversation.item.create event is used to add a new item to the conversation's context, including messages, function calls, and function call responses.
RealtimeClientEventConversationItemDelete	The client conversation.item.delete event is used to remove an item from the conversation history.
RealtimeClientEventConversationItemRetrieve	The client conversation.item.retrieve event is used to retrieve an item from the conversation history.
RealtimeClientEventConversationItemTruncate	The client conversation.item.truncate event is used to truncate a previous assistant message's audio.
RealtimeClientEventInputAudioBufferAppend	The client input_audio_buffer.append event is used to append audio bytes to the input audio buffer.
RealtimeClientEventInputAudioBufferClear	The client input_audio_buffer.clear event is used to clear the audio bytes in the buffer.
RealtimeClientEventInputAudioBufferCommit	The client input_audio_buffer.commit event is used to commit the user input audio buffer.
RealtimeClientEventOutputAudioBufferClear	The client output_audio_buffer.clear event is used to clear the audio bytes in the output buffer.

This event is only applicable for WebRTC.
RealtimeClientEventResponseCancel	The client response.cancel event is used to cancel an in-progress response.
RealtimeClientEventResponseCreate	The client response.create event is used to instruct the server to create a response via model inferencing.
RealtimeClientEventSessionUpdate	The client session.update event is used to update the session's default configuration.
RealtimeClientEventConversationItemCreate
The client conversation.item.create event is used to add a new item to the conversation's context, including messages, function calls, and function call responses. This event can be used to populate a history of the conversation and to add new items mid-stream. Currently this event can't populate assistant audio messages.

If successful, the server responds with a conversation.item.created event, otherwise an error event is sent.

Event structure
JSON

Copy
{
  "type": "conversation.item.create",
  "previous_item_id": "<previous_item_id>"
}
Properties
Field	Type	Description
type	string	The event type must be conversation.item.create.
previous_item_id	string	The ID of the preceding item after which the new item is inserted. If not set, the new item is appended to the end of the conversation. If set, it allows an item to be inserted mid-conversation. If the ID can't be found, then an error is returned and the item isn't added.
item	RealtimeConversationRequestItem	The item to add to the conversation.
RealtimeClientEventConversationItemDelete
The client conversation.item.delete event is used to remove an item from the conversation history.

The server responds with a conversation.item.deleted event, unless the item doesn't exist in the conversation history, in which case the server responds with an error.

Event structure
JSON

Copy
{
  "type": "conversation.item.delete",
  "item_id": "<item_id>"
}
Properties
Field	Type	Description
type	string	The event type must be conversation.item.delete.
item_id	string	The ID of the item to delete.
RealtimeClientEventConversationItemRetrieve
The client conversation.item.retrieve event is used to retrieve the server's representation of a specific item in the conversation history. This event is useful, for example, to inspect user audio after noise cancellation and VAD.

If the client event is successful, the server responds with a conversation.item.retrieved event. If the item doesn't exist in the conversation history, the server will respond with an error.

Event structure
JSON

Copy
{
  "type": "conversation.item.retrieve",
  "item_id": "<item_id>",
  "event_id": "<event_id>"
}
Properties
Field	Type	Description
type	string	The event type must be conversation.item.retrieve.
item_id	string	The ID of the item to retrieve.
event_id	string	The ID of the event.
RealtimeClientEventConversationItemTruncate
The client conversation.item.truncate event is used to truncate a previous assistant message's audio. The server produces audio faster than realtime, so this event is useful when the user interrupts to truncate audio that was sent to the client but not yet played. The server's understanding of the audio with the client's playback is synchronized.

Truncating audio deletes the server-side text transcript to ensure there isn't text in the context that the user doesn't know about.

If the client event is successful, the server responds with a conversation.item.truncated event.

Event structure
JSON

Copy
{
  "type": "conversation.item.truncate",
  "item_id": "<item_id>",
  "content_index": 0,
  "audio_end_ms": 0
}
Properties
Field	Type	Description
type	string	The event type must be conversation.item.truncate.
item_id	string	The ID of the assistant message item to truncate. Only assistant message items can be truncated.
content_index	integer	The index of the content part to truncate. Set this property to "0".
audio_end_ms	integer	Inclusive duration up to which audio is truncated, in milliseconds. If the audio_end_ms is greater than the actual audio duration, the server responds with an error.
RealtimeClientEventInputAudioBufferAppend
The client input_audio_buffer.append event is used to append audio bytes to the input audio buffer. The audio buffer is temporary storage you can write to and later commit.

In Server VAD (Voice Activity Detection) mode, the audio buffer is used to detect speech and the server decides when to commit. When server VAD is disabled, the client can choose how much audio to place in each event up to a maximum of 15 MiB. For example, streaming smaller chunks from the client can allow the VAD to be more responsive.

Unlike most other client events, the server doesn't send a confirmation response to client input_audio_buffer.append event.

Event structure
JSON

Copy
{
  "type": "input_audio_buffer.append",
  "audio": "<audio>"
}
Properties
Field	Type	Description
type	string	The event type must be input_audio_buffer.append.
audio	string	Base64-encoded audio bytes. This value must be in the format specified by the input_audio_format field in the session configuration.
RealtimeClientEventInputAudioBufferClear
The client input_audio_buffer.clear event is used to clear the audio bytes in the buffer.

The server responds with an input_audio_buffer.cleared event.

Event structure
JSON

Copy
{
  "type": "input_audio_buffer.clear"
}
Properties
Field	Type	Description
type	string	The event type must be input_audio_buffer.clear.
RealtimeClientEventInputAudioBufferCommit
The client input_audio_buffer.commit event is used to commit the user input audio buffer, which creates a new user message item in the conversation. Audio is transcribed if input_audio_transcription is configured for the session.

When in server VAD mode, the client doesn't need to send this event, the server commits the audio buffer automatically. Without server VAD, the client must commit the audio buffer to create a user message item. This client event produces an error if the input audio buffer is empty.

Committing the input audio buffer doesn't create a response from the model.

The server responds with an input_audio_buffer.committed event.

Event structure
JSON

Copy
{
  "type": "input_audio_buffer.commit"
}
Properties
Field	Type	Description
type	string	The event type must be input_audio_buffer.commit.
RealtimeClientEventOutputAudioBufferClear
The client output_audio_buffer.clear event is used to clear the audio bytes in the buffer.

 Note

This event is only applicable for WebRTC.

This event should be preceded by a response.cancel client event to stop the generation of the current response.

The server stops generating audio and responds with an output_audio_buffer.cleared event.

Event structure
JSON

Copy
{
  "type": "output_audio_buffer.clear"
}
Properties
Field	Type	Description
event_id	string	The ID of the event that caused the error.
type	string	The event type must be output_audio_buffer.clear.
RealtimeClientEventResponseCancel
The client response.cancel event is used to cancel an in-progress response.

The server responds with a response.cancelled event or an error if there's no response to cancel.

Event structure
JSON

Copy
{
  "type": "response.cancel"
}
Properties
Field	Type	Description
type	string	The event type must be response.cancel.
RealtimeClientEventResponseCreate
The client response.create event is used to instruct the server to create a response via model inferencing. When the session is configured in server VAD mode, the server creates responses automatically.

A response includes at least one item, and can have two, in which case the second is a function call. These items are appended to the conversation history.

The server responds with a response.created event, one or more item and content events (such as conversation.item.created and response.content_part.added), and finally a response.done event to indicate the response is complete.

 Note

The client response.create event includes inference configuration like instructions, and temperature. These fields can override the session's configuration for this response only.

Event structure
JSON

Copy
{
  "type": "response.create"
}
Properties
Field	Type	Description
type	string	The event type must be response.create.
response	RealtimeResponseOptions	The response options.
RealtimeClientEventSessionUpdate
The client session.update event is used to update the session's default configuration. The client can send this event at any time to update the session configuration, and any field can be updated at any time, except for voice.

Only fields that are present are updated. To clear a field (such as instructions), pass an empty string.

The server responds with a session.updated event that contains the full effective configuration.

Event structure
JSON

Copy
{
  "type": "session.update"
}
Properties
Field	Type	Description
type	string	The event type must be session.update.
session	RealtimeRequestSession	The session configuration.
Server events
There are 28 server events that can be received from the server:

Event	Description
RealtimeServerEventConversationCreated	The server conversation.created event is returned right after session creation. One conversation is created per session.
RealtimeServerEventConversationItemCreated	The server conversation.item.created event is returned when a conversation item is created.
RealtimeServerEventConversationItemRetrieved	The server conversation.item.retrieved event is returned when a conversation item is retrieved.
RealtimeServerEventConversationItemDeleted	The server conversation.item.deleted event is returned when the client deleted an item in the conversation with a conversation.item.delete event.
RealtimeServerEventConversationItemInputAudioTranscriptionCompleted	The server conversation.item.input_audio_transcription.completed event is the result of audio transcription for speech written to the audio buffer.
RealtimeServerEventConversationItemInputAudioTranscriptionFailed	The server conversation.item.input_audio_transcription.failed event is returned when input audio transcription is configured, and a transcription request for a user message failed.
RealtimeServerEventConversationItemTruncated	The server conversation.item.truncated event is returned when the client truncates an earlier assistant audio message item with a conversation.item.truncate event.
RealtimeServerEventError	The server error event is returned when an error occurs, which could be a client problem or a server problem.
RealtimeServerEventInputAudioBufferCleared	The server input_audio_buffer.cleared event is returned when the client clears the input audio buffer with a input_audio_buffer.clear event.
RealtimeServerEventInputAudioBufferCommitted	The server input_audio_buffer.committed event is returned when an input audio buffer is committed, either by the client or automatically in server VAD mode.
RealtimeServerEventInputAudioBufferSpeechStarted	The server input_audio_buffer.speech_started event is returned in server_vad mode when speech is detected in the audio buffer.
RealtimeServerEventInputAudioBufferSpeechStopped	The server input_audio_buffer.speech_stopped event is returned in server_vad mode when the server detects the end of speech in the audio buffer.
RealtimeServerEventOutputAudioBufferCleared	The server output_audio_buffer.cleared event is returned when the user has interrupted (input_audio_buffer.speech_started), or when the client has emitted the output_audio_buffer.clear event to manually cut off the current audio response.

This event is only applicable for WebRTC.
RealtimeServerEventOutputAudioBufferStarted	The server output_audio_buffer.started event is returned when the server begins streaming audio to the client. This event is emitted after an audio content part has been added (response.content_part.added) to the response.

This event is only applicable for WebRTC.
RealtimeServerEventOutputAudioBufferStopped	The server output_audio_buffer.stopped event is returned when the output audio buffer has been completely drained on the server, and no more audio is forthcoming.

This event is only applicable for WebRTC.
RealtimeServerEventRateLimitsUpdated	The server rate_limits.updated event is emitted at the beginning of a response to indicate the updated rate limits.
RealtimeServerEventResponseAudioDelta	The server response.audio.delta event is returned when the model-generated audio is updated.
RealtimeServerEventResponseAudioDone	The server response.audio.done event is returned when the model-generated audio is done.
RealtimeServerEventResponseAudioTranscriptDelta	The server response.audio_transcript.delta event is returned when the model-generated transcription of audio output is updated.
RealtimeServerEventResponseAudioTranscriptDone	The server response.audio_transcript.done event is returned when the model-generated transcription of audio output is done streaming.
RealtimeServerEventResponseContentPartAdded	The server response.content_part.added event is returned when a new content part is added to an assistant message item.
RealtimeServerEventResponseContentPartDone	The server response.content_part.done event is returned when a content part is done streaming.
RealtimeServerEventResponseCreated	The server response.created event is returned when a new response is created. This is the first event of response creation, where the response is in an initial state of in_progress.
RealtimeServerEventResponseDone	The server response.done event is returned when a response is done streaming.
RealtimeServerEventResponseFunctionCallArgumentsDelta	The server response.function_call_arguments.delta event is returned when the model-generated function call arguments are updated.
RealtimeServerEventResponseFunctionCallArgumentsDone	The server response.function_call_arguments.done event is returned when the model-generated function call arguments are done streaming.
RealtimeServerEventResponseOutputItemAdded	The server response.output_item.added event is returned when a new item is created during response generation.
RealtimeServerEventResponseOutputItemDone	The server response.output_item.done event is returned when an item is done streaming.
RealtimeServerEventResponseTextDelta	The server response.text.delta event is returned when the model-generated text is updated.
RealtimeServerEventResponseTextDone	The server response.text.done event is returned when the model-generated text is done streaming.
RealtimeServerEventSessionCreated	The server session.created event is the first server event when you establish a new connection to the Realtime API. This event creates and returns a new session with the default session configuration.
RealtimeServerEventSessionUpdated	The server session.updated event is returned when a session is updated by the client. If there's an error, the server sends an error event instead.
RealtimeServerEventConversationCreated
The server conversation.created event is returned right after session creation. One conversation is created per session.

Event structure
JSON

Copy
{
  "type": "conversation.created",
  "conversation": {
    "id": "<id>",
    "object": "<object>"
  }
}
Properties
Field	Type	Description
type	string	The event type must be conversation.created.
conversation	object	The conversation resource.
Conversation properties
Field	Type	Description
id	string	The unique ID of the conversation.
object	string	The object type must be realtime.conversation.
RealtimeServerEventConversationItemCreated
The server conversation.item.created event is returned when a conversation item is created. There are several scenarios that produce this event:

The server is generating a response, which if successful produces either one or two items, which is of type message (role assistant) or type function_call.
The input audio buffer is committed, either by the client or the server (in server_vad mode). The server takes the content of the input audio buffer and adds it to a new user message item.
The client sent a conversation.item.create event to add a new item to the conversation.
Event structure
JSON

Copy
{
  "type": "conversation.item.created",
  "previous_item_id": "<previous_item_id>"
}
Properties
Field	Type	Description
type	string	The event type must be conversation.item.created.
previous_item_id	string	The ID of the preceding item in the conversation context, allows the client to understand the order of the conversation.
item	RealtimeConversationResponseItem	The item that was created.
RealtimeServerEventConversationItemRetrieved
The server conversation.item.retrieved event is returned when a conversation item is retrieved.

Event structure
JSON

Copy
{
  "type": "conversation.item.retrieved",
  "previous_item_id": "<previous_item_id>"
}
Properties
Field	Type	Description
type	string	The event type must be conversation.item.retrieved.
event_id	string	The ID of the event.
item	RealtimeConversationResponseItem	The item that was retrieved.
RealtimeServerEventConversationItemDeleted
The server conversation.item.deleted event is returned when the client deleted an item in the conversation with a conversation.item.delete event. This event is used to synchronize the server's understanding of the conversation history with the client's view.

Event structure
JSON

Copy
{
  "type": "conversation.item.deleted",
  "item_id": "<item_id>"
}
Properties
Field	Type	Description
type	string	The event type must be conversation.item.deleted.
item_id	string	The ID of the item that was deleted.
RealtimeServerEventConversationItemInputAudioTranscriptionCompleted
The server conversation.item.input_audio_transcription.completed event is the result of audio transcription for speech written to the audio buffer.

Transcription begins when the input audio buffer is committed by the client or server (in server_vad mode). Transcription runs asynchronously with response creation, so this event can come before or after the response events.

Realtime API models accept audio natively, and thus input transcription is a separate process run on a separate speech recognition model such as whisper-1. Thus the transcript can diverge somewhat from the model's interpretation, and should be treated as a rough guide.

Event structure
JSON

Copy
{
  "type": "conversation.item.input_audio_transcription.completed",
  "item_id": "<item_id>",
  "content_index": 0,
  "transcript": "<transcript>"
}
Properties
Field	Type	Description
type	string	The event type must be conversation.item.input_audio_transcription.completed.
item_id	string	The ID of the user message item containing the audio.
content_index	integer	The index of the content part containing the audio.
transcript	string	The transcribed text.
RealtimeServerEventConversationItemInputAudioTranscriptionFailed
The server conversation.item.input_audio_transcription.failed event is returned when input audio transcription is configured, and a transcription request for a user message failed. This event is separate from other error events so that the client can identify the related item.

Event structure
JSON

Copy
{
  "type": "conversation.item.input_audio_transcription.failed",
  "item_id": "<item_id>",
  "content_index": 0,
  "error": {
    "code": "<code>",
    "message": "<message>",
    "param": "<param>"
  }
}
Properties
Field	Type	Description
type	string	The event type must be conversation.item.input_audio_transcription.failed.
item_id	string	The ID of the user message item.
content_index	integer	The index of the content part containing the audio.
error	object	Details of the transcription error.

See nested properties in the next table.
Error properties
Field	Type	Description
type	string	The type of error.
code	string	Error code, if any.
message	string	A human-readable error message.
param	string	Parameter related to the error, if any.
RealtimeServerEventConversationItemTruncated
The server conversation.item.truncated event is returned when the client truncates an earlier assistant audio message item with a conversation.item.truncate event. This event is used to synchronize the server's understanding of the audio with the client's playback.

This event truncates the audio and removes the server-side text transcript to ensure there's no text in the context that the user doesn't know about.

Event structure
JSON

Copy
{
  "type": "conversation.item.truncated",
  "item_id": "<item_id>",
  "content_index": 0,
  "audio_end_ms": 0
}
Properties
Field	Type	Description
type	string	The event type must be conversation.item.truncated.
item_id	string	The ID of the assistant message item that was truncated.
content_index	integer	The index of the content part that was truncated.
audio_end_ms	integer	The duration up to which the audio was truncated, in milliseconds.
RealtimeServerEventError
The server error event is returned when an error occurs, which could be a client problem or a server problem. Most errors are recoverable and the session stays open.

Event structure
JSON

Copy
{
  "type": "error",
  "error": {
    "code": "<code>",
    "message": "<message>",
    "param": "<param>",
    "event_id": "<event_id>"
  }
}
Properties
Field	Type	Description
type	string	The event type must be error.
error	object	Details of the error.

See nested properties in the next table.
Error properties
Field	Type	Description
type	string	The type of error. For example, "invalid_request_error" and "server_error" are error types.
code	string	Error code, if any.
message	string	A human-readable error message.
param	string	Parameter related to the error, if any.
event_id	string	The ID of the client event that caused the error, if applicable.
RealtimeServerEventInputAudioBufferCleared
The server input_audio_buffer.cleared event is returned when the client clears the input audio buffer with a input_audio_buffer.clear event.

Event structure
JSON

Copy
{
  "type": "input_audio_buffer.cleared"
}
Properties
Field	Type	Description
type	string	The event type must be input_audio_buffer.cleared.
RealtimeServerEventInputAudioBufferCommitted
The server input_audio_buffer.committed event is returned when an input audio buffer is committed, either by the client or automatically in server VAD mode. The item_id property is the ID of the user message item created. Thus a conversation.item.created event is also sent to the client.

Event structure
JSON

Copy
{
  "type": "input_audio_buffer.committed",
  "previous_item_id": "<previous_item_id>",
  "item_id": "<item_id>"
}
Properties
Field	Type	Description
type	string	The event type must be input_audio_buffer.committed.
previous_item_id	string	The ID of the preceding item after which the new item is inserted.
item_id	string	The ID of the user message item created.
RealtimeServerEventInputAudioBufferSpeechStarted
The server input_audio_buffer.speech_started event is returned in server_vad mode when speech is detected in the audio buffer. This event can happen any time audio is added to the buffer (unless speech is already detected).

 Note

The client might want to use this event to interrupt audio playback or provide visual feedback to the user.

The client should expect to receive a input_audio_buffer.speech_stopped event when speech stops. The item_id property is the ID of the user message item created when speech stops. The item_id is also included in the input_audio_buffer.speech_stopped event unless the client manually commits the audio buffer during VAD activation.

Event structure
JSON

Copy
{
  "type": "input_audio_buffer.speech_started",
  "audio_start_ms": 0,
  "item_id": "<item_id>"
}
Properties
Field	Type	Description
type	string	The event type must be input_audio_buffer.speech_started.
audio_start_ms	integer	Milliseconds from the start of all audio written to the buffer during the session when speech was first detected. This property corresponds to the beginning of audio sent to the model, and thus includes the prefix_padding_ms configured in the session.
item_id	string	The ID of the user message item created when speech stops.
RealtimeServerEventInputAudioBufferSpeechStopped
The server input_audio_buffer.speech_stopped event is returned in server_vad mode when the server detects the end of speech in the audio buffer.

The server also sends a conversation.item.created event with the user message item created from the audio buffer.

Event structure
JSON

Copy
{
  "type": "input_audio_buffer.speech_stopped",
  "audio_end_ms": 0,
  "item_id": "<item_id>"
}
Properties
Field	Type	Description
type	string	The event type must be input_audio_buffer.speech_stopped.
audio_end_ms	integer	Milliseconds since the session started when speech stopped. This property corresponds to the end of audio sent to the model, and thus includes the min_silence_duration_ms configured in the session.
item_id	string	The ID of the user message item created.
RealtimeServerEventOutputAudioBufferCleared
The server output_audio_buffer.cleared event is returned when the output audio buffer is cleared.

 Note

This event is only applicable for WebRTC.

This happens either in VAD mode when the user has interrupted (input_audio_buffer.speech_started), or when the client has emitted the output_audio_buffer.clear event to manually cut off the current audio response.

Event structure
JSON

Copy
{
  "type": "output_audio_buffer.cleared"
}
Properties
Field	Type	Description
type	string	The event type must be output_audio_buffer.cleared.
event_id	string	The ID of the server event.
response_id	string	The unique ID of the response that produced the audio.
RealtimeServerEventOutputAudioBufferStarted
The server output_audio_buffer.started event is returned when the server begins streaming audio to the client. This event is emitted after an audio content part has been added (response.content_part.added) to the response.

 Note

This event is only applicable for WebRTC.

Event structure
JSON

Copy
{
  "type": "output_audio_buffer.started",
  "event_id": "<item_id>",
  "response_id": "<response_id>"
}
Properties
Field	Type	Description
type	string	The event type must be output_audio_buffer.started.
event_id	string	The ID of the server event.
response_id	string	The unique ID of the response that produced the audio.
RealtimeServerEventOutputAudioBufferStopped
The server output_audio_buffer.stopped event is returned when the output audio buffer has been completely drained on the server, and no more audio is forthcoming.

 Note

This event is only applicable for WebRTC.

This event is returned after the full response data has been sent to the client via the response.done event.

Event structure
JSON

Copy
{
  "type": "output_audio_buffer.stopped",
  "audio_end_ms": 0,
  "item_id": "<item_id>"
}
Properties
Field	Type	Description
type	string	The event type must be output_audio_buffer.stopped.
event_id	string	The ID of the server event.
response_id	string	The unique ID of the response that produced the audio.
RealtimeServerEventRateLimitsUpdated
The server rate_limits.updated event is emitted at the beginning of a response to indicate the updated rate limits.

When a response is created, some tokens are reserved for the output tokens. The rate limits shown here reflect that reservation, which is then adjusted accordingly once the response is completed.

Event structure
JSON

Copy
{
  "type": "rate_limits.updated",
  "rate_limits": [
    {
      "name": "<name>",
      "limit": 0,
      "remaining": 0,
      "reset_seconds": 0
    }
  ]
}
Properties
Field	Type	Description
type	string	The event type must be rate_limits.updated.
rate_limits	array of RealtimeServerEventRateLimitsUpdatedRateLimitsItem	The list of rate limit information.
RealtimeServerEventResponseAudioDelta
The server response.audio.delta event is returned when the model-generated audio is updated.

Event structure
JSON

Copy
{
  "type": "response.audio.delta",
  "response_id": "<response_id>",
  "item_id": "<item_id>",
  "output_index": 0,
  "content_index": 0,
  "delta": "<delta>"
}
Properties
Field	Type	Description
type	string	The event type must be response.audio.delta.
response_id	string	The ID of the response.
item_id	string	The ID of the item.
output_index	integer	The index of the output item in the response.
content_index	integer	The index of the content part in the item's content array.
delta	string	Base64-encoded audio data delta.
RealtimeServerEventResponseAudioDone
The server response.audio.done event is returned when the model-generated audio is done.

This event is also returned when a response is interrupted, incomplete, or canceled.

Event structure
JSON

Copy
{
  "type": "response.audio.done",
  "response_id": "<response_id>",
  "item_id": "<item_id>",
  "output_index": 0,
  "content_index": 0
}
Properties
Field	Type	Description
type	string	The event type must be response.audio.done.
response_id	string	The ID of the response.
item_id	string	The ID of the item.
output_index	integer	The index of the output item in the response.
content_index	integer	The index of the content part in the item's content array.
RealtimeServerEventResponseAudioTranscriptDelta
The server response.audio_transcript.delta event is returned when the model-generated transcription of audio output is updated.

Event structure
JSON

Copy
{
  "type": "response.audio_transcript.delta",
  "response_id": "<response_id>",
  "item_id": "<item_id>",
  "output_index": 0,
  "content_index": 0,
  "delta": "<delta>"
}
Properties
Field	Type	Description
type	string	The event type must be response.audio_transcript.delta.
response_id	string	The ID of the response.
item_id	string	The ID of the item.
output_index	integer	The index of the output item in the response.
content_index	integer	The index of the content part in the item's content array.
delta	string	The transcript delta.
RealtimeServerEventResponseAudioTranscriptDone
The server response.audio_transcript.done event is returned when the model-generated transcription of audio output is done streaming.

This event is also returned when a response is interrupted, incomplete, or canceled.

Event structure
JSON

Copy
{
  "type": "response.audio_transcript.done",
  "response_id": "<response_id>",
  "item_id": "<item_id>",
  "output_index": 0,
  "content_index": 0,
  "transcript": "<transcript>"
}
Properties
Field	Type	Description
type	string	The event type must be response.audio_transcript.done.
response_id	string	The ID of the response.
item_id	string	The ID of the item.
output_index	integer	The index of the output item in the response.
content_index	integer	The index of the content part in the item's content array.
transcript	string	The final transcript of the audio.
RealtimeServerEventResponseContentPartAdded
The server response.content_part.added event is returned when a new content part is added to an assistant message item during response generation.

Event structure
JSON

Copy
{
  "type": "response.content_part.added",
  "response_id": "<response_id>",
  "item_id": "<item_id>",
  "output_index": 0,
  "content_index": 0
}
Properties
Field	Type	Description
type	string	The event type must be response.content_part.added.
response_id	string	The ID of the response.
item_id	string	The ID of the item to which the content part was added.
output_index	integer	The index of the output item in the response.
content_index	integer	The index of the content part in the item's content array.
part	RealtimeContentPart	The content part that was added.
Part properties
Field	Type	Description
type	RealtimeContentPartType	
RealtimeServerEventResponseContentPartDone
The server response.content_part.done event is returned when a content part is done streaming in an assistant message item.

This event is also returned when a response is interrupted, incomplete, or canceled.

Event structure
JSON

Copy
{
  "type": "response.content_part.done",
  "response_id": "<response_id>",
  "item_id": "<item_id>",
  "output_index": 0,
  "content_index": 0
}
Properties
Field	Type	Description
type	string	The event type must be response.content_part.done.
response_id	string	The ID of the response.
item_id	string	The ID of the item.
output_index	integer	The index of the output item in the response.
content_index	integer	The index of the content part in the item's content array.
part	RealtimeContentPart	The content part that is done.
Part properties
Field	Type	Description
type	RealtimeContentPartType	
RealtimeServerEventResponseCreated
The server response.created event is returned when a new response is created. This is the first event of response creation, where the response is in an initial state of in_progress.

Event structure
JSON

Copy
{
  "type": "response.created"
}
Properties
Field	Type	Description
type	string	The event type must be response.created.
response	RealtimeResponse	The response object.
RealtimeServerEventResponseDone
The server response.done event is returned when a response is done streaming. This event is always emitted, no matter the final state. The response object included in the response.done event includes all output items in the response, but omits the raw audio data.

Event structure
JSON

Copy
{
  "type": "response.done"
}
Properties
Field	Type	Description
type	string	The event type must be response.done.
response	RealtimeResponse	The response object.
RealtimeServerEventResponseFunctionCallArgumentsDelta
The server response.function_call_arguments.delta event is returned when the model-generated function call arguments are updated.

Event structure
JSON

Copy
{
  "type": "response.function_call_arguments.delta",
  "response_id": "<response_id>",
  "item_id": "<item_id>",
  "output_index": 0,
  "call_id": "<call_id>",
  "delta": "<delta>"
}
Properties
Field	Type	Description
type	string	The event type must be response.function_call_arguments.delta.
response_id	string	The ID of the response.
item_id	string	The ID of the function call item.
output_index	integer	The index of the output item in the response.
call_id	string	The ID of the function call.
delta	string	The arguments delta as a JSON string.
RealtimeServerEventResponseFunctionCallArgumentsDone
The server response.function_call_arguments.done event is returned when the model-generated function call arguments are done streaming.

This event is also returned when a response is interrupted, incomplete, or canceled.

Event structure
JSON

Copy
{
  "type": "response.function_call_arguments.done",
  "response_id": "<response_id>",
  "item_id": "<item_id>",
  "output_index": 0,
  "call_id": "<call_id>",
  "arguments": "<arguments>"
}
Properties
Field	Type	Description
type	string	The event type must be response.function_call_arguments.done.
response_id	string	The ID of the response.
item_id	string	The ID of the function call item.
output_index	integer	The index of the output item in the response.
call_id	string	The ID of the function call.
arguments	string	The final arguments as a JSON string.
RealtimeServerEventResponseOutputItemAdded
The server response.output_item.added event is returned when a new item is created during response generation.

Event structure
JSON

Copy
{
  "type": "response.output_item.added",
  "response_id": "<response_id>",
  "output_index": 0
}
Properties
Field	Type	Description
type	string	The event type must be response.output_item.added.
response_id	string	The ID of the response to which the item belongs.
output_index	integer	The index of the output item in the response.
item	RealtimeConversationResponseItem	The item that was added.
RealtimeServerEventResponseOutputItemDone
The server response.output_item.done event is returned when an item is done streaming.

This event is also returned when a response is interrupted, incomplete, or canceled.

Event structure
JSON

Copy
{
  "type": "response.output_item.done",
  "response_id": "<response_id>",
  "output_index": 0
}
Properties
Field	Type	Description
type	string	The event type must be response.output_item.done.
response_id	string	The ID of the response to which the item belongs.
output_index	integer	The index of the output item in the response.
item	RealtimeConversationResponseItem	The item that is done streaming.
RealtimeServerEventResponseTextDelta
The server response.text.delta event is returned when the model-generated text is updated. The text corresponds to the text content part of an assistant message item.

Event structure
JSON

Copy
{
  "type": "response.text.delta",
  "response_id": "<response_id>",
  "item_id": "<item_id>",
  "output_index": 0,
  "content_index": 0,
  "delta": "<delta>"
}
Properties
Field	Type	Description
type	string	The event type must be response.text.delta.
response_id	string	The ID of the response.
item_id	string	The ID of the item.
output_index	integer	The index of the output item in the response.
content_index	integer	The index of the content part in the item's content array.
delta	string	The text delta.
RealtimeServerEventResponseTextDone
The server response.text.done event is returned when the model-generated text is done streaming. The text corresponds to the text content part of an assistant message item.

This event is also returned when a response is interrupted, incomplete, or canceled.

Event structure
JSON

Copy
{
  "type": "response.text.done",
  "response_id": "<response_id>",
  "item_id": "<item_id>",
  "output_index": 0,
  "content_index": 0,
  "text": "<text>"
}
Properties
Field	Type	Description
type	string	The event type must be response.text.done.
response_id	string	The ID of the response.
item_id	string	The ID of the item.
output_index	integer	The index of the output item in the response.
content_index	integer	The index of the content part in the item's content array.
text	string	The final text content.
RealtimeServerEventSessionCreated
The server session.created event is the first server event when you establish a new connection to the Realtime API. This event creates and returns a new session with the default session configuration.

Event structure
JSON

Copy
{
  "type": "session.created"
}
Properties
Field	Type	Description
type	string	The event type must be session.created.
session	RealtimeResponseSession	The session object.
RealtimeServerEventSessionUpdated
The server session.updated event is returned when a session is updated by the client. If there's an error, the server sends an error event instead.

Event structure
JSON

Copy
{
  "type": "session.updated"
}
Properties
Field	Type	Description
type	string	The event type must be session.updated.
session	RealtimeResponseSession	The session object.
Components
RealtimeAudioFormat
Allowed Values:

pcm16
g711_ulaw
g711_alaw
RealtimeAudioInputTranscriptionModel
Allowed Values:

whisper-1
gpt-4o-transcribe
gpt-4o-mini-transcribe
RealtimeAudioInputTranscriptionSettings
Field	Type	Description
language	string	The language of the input audio. Supplying the input language in ISO-639-1 format (such as en) will improve accuracy and latency.
model	RealtimeAudioInputTranscriptionModel	The model for audio input transcription. For example, whisper-1.
prompt	string	The prompt for the audio input transcription. Optional text to guide the model's style or continue a previous audio segment. For the whisper-1 model, the prompt is a list of keywords. For the gpt-4o-transcribe and gpt-4o-mini-transcribe models, the prompt is a free text string such as "expect words related to technology."
RealtimeAudioInputAudioNoiseReductionSettings
Field	Type	Description
type	string	Type of noise reduction. Specify near_field for close-talking microphones such as headphones or far_field for far-field microphones such as laptop or conference room microphones.
RealtimeClientEvent
Field	Type	Description
type	RealtimeClientEventType	The type of the client event.
event_id	string	The unique ID of the event. The client can specify the ID to help identify the event.
RealtimeClientEventType
Allowed Values:

session.update
input_audio_buffer.append
input_audio_buffer.commit
input_audio_buffer.clear
conversation.item.create
conversation.item.delete
conversation.item.truncate
response.create
response.cancel
RealtimeContentPart
Field	Type	Description
type	RealtimeContentPartType	The content type.

A property of the function object.

Allowed values: input_text, input_audio, item_reference, text.
text	string	The text content. This property is applicable for the input_text and text content types.
id	string	ID of a previous conversation item to reference in both client and server created items. This property is applicable for the item_reference content type in response.create events.
audio	string	The base64-encoded audio bytes. This property is applicable for the input_audio content type.
transcript	string	The transcript of the audio. This property is applicable for the input_audio content type.
RealtimeContentPartType
Allowed Values:

input_text
input_audio
text
audio
RealtimeConversationItemBase
The item to add to the conversation.

This table describes all RealtimeConversationItem properties. The properties that are applicable per event depend on the RealtimeItemType.

Field	Type	Description
id	string	The unique ID of the item. The client can specify the ID to help manage server-side context. If the client doesn't provide an ID, the server generates one.
type	RealtimeItemType	The type of the item.

Allowed values: message, function_call, function_call_output
object	string	The identifier for the API object being returned. The value will always be realtime.item.
status	RealtimeItemStatus	The status of the item. This field doesn't affect the conversation, but it's accepted for consistency with the conversation.item.created event.

Allowed values: completed, incomplete
role	RealtimeMessageRole	The role of the message sender. This property is only applicable for message items.

Allowed values: system, user, assistant
content	array of RealtimeContentPart	The content of the message. This property is only applicable for message items.

- Message items of role system support only input_text content.
- Message items of role user support input_text and input_audio content.
- Message items of role assistant support text content.
call_id	string	The ID of the function call (for function_call and function_call_output items). If passed on a function_call_output item, the server will check that a function_call item with the same ID exists in the conversation history.
name	string	The name of the function being called (for function_call items).
arguments	string	The arguments of the function call (for function_call items).
output	string	The output of the function call (for function_call_output items).
RealtimeConversationRequestItem
You use the RealtimeConversationRequestItem object to create a new item in the conversation via the conversation.item.create event.

Field	Type	Description
type	RealtimeItemType	The type of the item.
id	string	The unique ID of the item. The client can specify the ID to help manage server-side context. If the client doesn't provide an ID, the server generates one.
RealtimeConversationResponseItem
The RealtimeConversationResponseItem object represents an item in the conversation. It's used in some of the server events, such as:

conversation.item.created
response.output_item.added
response.output_item.done
response.created (via the response property type RealtimeResponse)
response.done (via the response property type RealtimeResponse)
Field	Type	Description
object	string	The identifier for the returned API object.

Allowed values: realtime.item
type	RealtimeItemType	The type of the item.

Allowed values: message, function_call, function_call_output
id	string	The unique ID of the item. The client can specify the ID to help manage server-side context. If the client doesn't provide an ID, the server generates one.

This property is nullable.
RealtimeFunctionTool
The definition of a function tool as used by the realtime endpoint.

Field	Type	Description
type	string	The type of the tool.

Allowed values: function
name	string	The name of the function.
description	string	The description of the function, including usage guidelines. For example, "Use this function to get the current time."
parameters	object	The parameters of the function in the form of a JSON object.
RealtimeItemStatus
Allowed Values:

in_progress
completed
incomplete
RealtimeItemType
Allowed Values:

message
function_call
function_call_output
RealtimeMessageRole
Allowed Values:

system
user
assistant
RealtimeRequestAssistantMessageItem
Field	Type	Description
role	string	The role of the message.

Allowed values: assistant
content	array of RealtimeRequestTextContentPart	The content of the message.
RealtimeRequestAudioContentPart
Field	Type	Description
type	string	The type of the content part.

Allowed values: input_audio
transcript	string	The transcript of the audio.
RealtimeRequestFunctionCallItem
Field	Type	Description
type	string	The type of the item.

Allowed values: function_call
name	string	The name of the function call item.
call_id	string	The ID of the function call item.
arguments	string	The arguments of the function call item.
status	RealtimeItemStatus	The status of the item.
RealtimeRequestFunctionCallOutputItem
Field	Type	Description
type	string	The type of the item.

Allowed values: function_call_output
call_id	string	The ID of the function call item.
output	string	The output of the function call item.
RealtimeRequestMessageItem
Field	Type	Description
type	string	The type of the item.

Allowed values: message
role	RealtimeMessageRole	The role of the message.
status	RealtimeItemStatus	The status of the item.
RealtimeRequestMessageReferenceItem
Field	Type	Description
type	string	The type of the item.

Allowed values: message
id	string	The ID of the message item.
RealtimeRequestSession
You use the RealtimeRequestSession object when you want to update the session configuration via the session.update event.

Field	Type	Description
modalities	array	The modalities that the session supports.

Allowed values: text, audio

For example, "modalities": ["text", "audio"] is the default setting that enables both text and audio modalities. To enable only text, set "modalities": ["text"]. You can't enable only audio.
instructions	string	The instructions (the system message) to guide the model's text and audio responses.

Here are some example instructions to help guide content and format of text and audio responses:
"instructions": "be succinct"
"instructions": "act friendly"
"instructions": "here are examples of good responses"

Here are some example instructions to help guide audio behavior:
"instructions": "talk quickly"
"instructions": "inject emotion into your voice"
"instructions": "laugh frequently"

While the model might not always follow these instructions, they provide guidance on the desired behavior.
voice	RealtimeVoice	The voice used for the model response for the session.

Once the voice is used in the session for the model's audio response, it can't be changed.
input_audio_format	RealtimeAudioFormat	The format for the input audio.
output_audio_format	RealtimeAudioFormat	The format for the output audio.
input_audio_noise_reduction	RealtimeAudioInputAudioNoiseReductionSettings	Configuration for input audio noise reduction. This can be set to null to turn off. Noise reduction filters audio added to the input audio buffer before it is sent to VAD and the model. Filtering the audio can improve VAD and turn detection accuracy (reducing false positives) and model performance by improving perception of the input audio.

This property is nullable.
input_audio_transcription	RealtimeAudioInputTranscriptionSettings	The configuration for input audio transcription. The configuration is null (off) by default. Input audio transcription isn't native to the model, since the model consumes audio directly. Transcription runs asynchronously through the /audio/transcriptions endpoint and should be treated as guidance of input audio content rather than precisely what the model heard. For additional guidance to the transcription service, the client can optionally set the language and prompt for transcription.

This property is nullable.
turn_detection	RealtimeTurnDetection	The turn detection settings for the session.

This property is nullable.
tools	array of RealtimeTool	The tools available to the model for the session.
tool_choice	RealtimeToolChoice	The tool choice for the session.

Allowed values: auto, none, and required. Otherwise, you can specify the name of the function to use.
temperature	number	The sampling temperature for the model. The allowed temperature values are limited to [0.6, 1.2]. Defaults to 0.8.
max_response_output_tokens	integer or "inf"	The maximum number of output tokens per assistant response, inclusive of tool calls.

Specify an integer between 1 and 4096 to limit the output tokens. Otherwise, set the value to "inf" to allow the maximum number of tokens.

For example, to limit the output tokens to 1000, set "max_response_output_tokens": 1000. To allow the maximum number of tokens, set "max_response_output_tokens": "inf".

Defaults to "inf".
RealtimeRequestSystemMessageItem
Field	Type	Description
role	string	The role of the message.

Allowed values: system
content	array of RealtimeRequestTextContentPart	The content of the message.
RealtimeRequestTextContentPart
Field	Type	Description
type	string	The type of the content part.

Allowed values: input_text
text	string	The text content.
RealtimeRequestUserMessageItem
Field	Type	Description
role	string	The role of the message.

Allowed values: user
content	array of RealtimeRequestTextContentPart or RealtimeRequestAudioContentPart	The content of the message.
RealtimeResponse
Field	Type	Description
object	string	The response object.

Allowed values: realtime.response
id	string	The unique ID of the response.
status	RealtimeResponseStatus	The status of the response.

The default status value is in_progress.
status_details	RealtimeResponseStatusDetails	The details of the response status.

This property is nullable.
output	array of RealtimeConversationResponseItem	The output items of the response.
usage	object	Usage statistics for the response. Each Realtime API session maintains a conversation context and appends new items to the conversation. Output from previous turns (text and audio tokens) is input for later turns.

See nested properties next.
+ total_tokens	integer	The total number of tokens in the Response including input and output text and audio tokens.

A property of the usage object.
+ input_tokens	integer	The number of input tokens used in the response, including text and audio tokens.

A property of the usage object.
+ output_tokens	integer	The number of output tokens sent in the response, including text and audio tokens.

A property of the usage object.
+ input_token_details	object	Details about the input tokens used in the response.

A property of the usage object.

See nested properties next.
+ cached_tokens	integer	The number of cached tokens used in the response.

A property of the input_token_details object.
+ text_tokens	integer	The number of text tokens used in the response.

A property of the input_token_details object.
+ audio_tokens	integer	The number of audio tokens used in the response.

A property of the input_token_details object.
+ output_token_details	object	Details about the output tokens used in the response.

A property of the usage object.

See nested properties next.
+ text_tokens	integer	The number of text tokens used in the response.

A property of the output_token_details object.
+ audio_tokens	integer	The number of audio tokens used in the response.

A property of the output_token_details object.
RealtimeResponseAudioContentPart
Field	Type	Description
type	string	The type of the content part.

Allowed values: audio
transcript	string	The transcript of the audio.

This property is nullable.
RealtimeResponseBase
The response resource.

RealtimeResponseFunctionCallItem
Field	Type	Description
type	string	The type of the item.

Allowed values: function_call
name	string	The name of the function call item.
call_id	string	The ID of the function call item.
arguments	string	The arguments of the function call item.
status	RealtimeItemStatus	The status of the item.
RealtimeResponseFunctionCallOutputItem
Field	Type	Description
type	string	The type of the item.

Allowed values: function_call_output
call_id	string	The ID of the function call item.
output	string	The output of the function call item.
RealtimeResponseMessageItem
Field	Type	Description
type	string	The type of the item.

Allowed values: message
role	RealtimeMessageRole	The role of the message.
content	array	The content of the message.

Array items: RealtimeResponseTextContentPart
status	RealtimeItemStatus	The status of the item.
RealtimeResponseOptions
Field	Type	Description
modalities	array	The modalities that the session supports.

Allowed values: text, audio

For example, "modalities": ["text", "audio"] is the default setting that enables both text and audio modalities. To enable only text, set "modalities": ["text"]. You can't enable only audio.
instructions	string	The instructions (the system message) to guide the model's text and audio responses.

Here are some example instructions to help guide content and format of text and audio responses:
"instructions": "be succinct"
"instructions": "act friendly"
"instructions": "here are examples of good responses"

Here are some example instructions to help guide audio behavior:
"instructions": "talk quickly"
"instructions": "inject emotion into your voice"
"instructions": "laugh frequently"

While the model might not always follow these instructions, they provide guidance on the desired behavior.
voice	RealtimeVoice	The voice used for the model response for the session.

Once the voice is used in the session for the model's audio response, it can't be changed.
output_audio_format	RealtimeAudioFormat	The format for the output audio.
tools	array of RealtimeTool	The tools available to the model for the session.
tool_choice	RealtimeToolChoice	The tool choice for the session.
temperature	number	The sampling temperature for the model. The allowed temperature values are limited to [0.6, 1.2]. Defaults to 0.8.
max__output_tokens	integer or "inf"	The maximum number of output tokens per assistant response, inclusive of tool calls.

Specify an integer between 1 and 4096 to limit the output tokens. Otherwise, set the value to "inf" to allow the maximum number of tokens.

For example, to limit the output tokens to 1000, set "max_response_output_tokens": 1000. To allow the maximum number of tokens, set "max_response_output_tokens": "inf".

Defaults to "inf".
conversation	string	Controls which conversation the response is added to. The supported values are auto and none.

The auto value (or not setting this property) ensures that the contents of the response are added to the session's default conversation.

Set this property to none to create an out-of-band response where items won't be added to the default conversation. For more information, see the how-to guide.

Defaults to "auto"
metadata	map	Set of up to 16 key-value pairs that can be attached to an object. This can be useful for storing additional information about the object in a structured format. Keys can be a maximum of 64 characters long and values can be a maximum of 512 characters long.

For example: metadata: { topic: "classification" }
input	array	Input items to include in the prompt for the model. Creates a new context for this response, without including the default conversation. Can include references to items from the default conversation.

Array items: RealtimeConversationItemBase
RealtimeResponseSession
The RealtimeResponseSession object represents a session in the Realtime API. It's used in some of the server events, such as:

session.created
session.updated
Field	Type	Description
object	string	The session object.

Allowed values: realtime.session
id	string	The unique ID of the session.
model	string	The model used for the session.
modalities	array	The modalities that the session supports.

Allowed values: text, audio

For example, "modalities": ["text", "audio"] is the default setting that enables both text and audio modalities. To enable only text, set "modalities": ["text"]. You can't enable only audio.
instructions	string	The instructions (the system message) to guide the model's text and audio responses.

Here are some example instructions to help guide content and format of text and audio responses:
"instructions": "be succinct"
"instructions": "act friendly"
"instructions": "here are examples of good responses"

Here are some example instructions to help guide audio behavior:
"instructions": "talk quickly"
"instructions": "inject emotion into your voice"
"instructions": "laugh frequently"

While the model might not always follow these instructions, they provide guidance on the desired behavior.
voice	RealtimeVoice	The voice used for the model response for the session.

Once the voice is used in the session for the model's audio response, it can't be changed.
input_audio_format	RealtimeAudioFormat	The format for the input audio.
output_audio_format	RealtimeAudioFormat	The format for the output audio.
input_audio_transcription	RealtimeAudioInputTranscriptionSettings	The settings for audio input transcription.

This property is nullable.
turn_detection	RealtimeTurnDetection	The turn detection settings for the session.

This property is nullable.
tools	array of RealtimeTool	The tools available to the model for the session.
tool_choice	RealtimeToolChoice	The tool choice for the session.
temperature	number	The sampling temperature for the model. The allowed temperature values are limited to [0.6, 1.2]. Defaults to 0.8.
max_response_output_tokens	integer or "inf"	The maximum number of output tokens per assistant response, inclusive of tool calls.

Specify an integer between 1 and 4096 to limit the output tokens. Otherwise, set the value to "inf" to allow the maximum number of tokens.

For example, to limit the output tokens to 1000, set "max_response_output_tokens": 1000. To allow the maximum number of tokens, set "max_response_output_tokens": "inf".
RealtimeResponseStatus
Allowed Values:

in_progress
completed
cancelled
incomplete
failed
RealtimeResponseStatusDetails
Field	Type	Description
type	RealtimeResponseStatus	The status of the response.
RealtimeResponseTextContentPart
Field	Type	Description
type	string	The type of the content part.

Allowed values: text
text	string	The text content.
RealtimeServerEvent
Field	Type	Description
type	RealtimeServerEventType	The type of the server event.
event_id	string	The unique ID of the server event.
RealtimeServerEventRateLimitsUpdatedRateLimitsItem
Field	Type	Description
name	string	The rate limit property name that this item includes information about.
limit	integer	The maximum configured limit for this rate limit property.
remaining	integer	The remaining quota available against the configured limit for this rate limit property.
reset_seconds	number	The remaining time, in seconds, until this rate limit property is reset.
RealtimeServerEventType
Allowed Values:

session.created
session.updated
conversation.created
conversation.item.created
conversation.item.deleted
conversation.item.truncated
response.created
response.done
rate_limits.updated
response.output_item.added
response.output_item.done
response.content_part.added
response.content_part.done
response.audio.delta
response.audio.done
response.audio_transcript.delta
response.audio_transcript.done
response.text.delta
response.text.done
response.function_call_arguments.delta
response.function_call_arguments.done
input_audio_buffer.speech_started
input_audio_buffer.speech_stopped
conversation.item.input_audio_transcription.completed
conversation.item.input_audio_transcription.failed
input_audio_buffer.committed
input_audio_buffer.cleared
error
RealtimeServerVadTurnDetection
Field	Type	Description
type	string	The type of turn detection.

Allowed values: server_vad
threshold	number	The activation threshold for the server VAD turn detection. In noisy environments, you might need to increase the threshold to avoid false positives. In quiet environments, you might need to decrease the threshold to avoid false negatives.

Defaults to 0.5. You can set the threshold to a value between 0.0 and 1.0.
prefix_padding_ms	string	The duration of speech audio (in milliseconds) to include before the start of detected speech.

Defaults to 300.
silence_duration_ms	string	The duration of silence (in milliseconds) to detect the end of speech. You want to detect the end of speech as soon as possible, but not too soon to avoid cutting off the last part of the speech.

The model will respond more quickly if you set this value to a lower number, but it might cut off the last part of the speech. If you set this value to a higher number, the model will wait longer to detect the end of speech, but it might take longer to respond.
RealtimeSessionBase
Realtime session object configuration.

RealtimeTool
The base representation of a realtime tool definition.

Field	Type	Description
type	RealtimeToolType	The type of the tool.
RealtimeToolChoice
The combined set of available representations for a realtime tool_choice parameter, encompassing both string literal options like 'auto' and structured references to defined tools.

RealtimeToolChoiceFunctionObject
The representation of a realtime tool_choice selecting a named function tool.

Field	Type	Description
type	string	The type of the tool_choice.

Allowed values: function
function	object	The function tool to select.

See nested properties next.
+ name	string	The name of the function tool.

A property of the function object.
RealtimeToolChoiceLiteral
The available set of mode-level, string literal tool_choice options for the realtime endpoint.

Allowed Values:

auto
none
required
RealtimeToolChoiceObject
A base representation for a realtime tool_choice selecting a named tool.

Field	Type	Description
type	RealtimeToolType	The type of the tool_choice.
RealtimeToolType
The supported tool type discriminators for realtime tools. Currently, only 'function' tools are supported.

Allowed Values:

function
RealtimeTurnDetection
Field	Type	Description
type	RealtimeTurnDetectionType	The type of turn detection.

Allowed values: semantic_vad or server_vad
threshold	number	The activation threshold for the server VAD (server_vad) turn detection. In noisy environments, you might need to increase the threshold to avoid false positives. In quiet environments, you might need to decrease the threshold to avoid false negatives.

Defaults to 0.5. You can set the threshold to a value between 0.0 and 1.0.

This property is only applicable for server_vad turn detection.
prefix_padding_ms	string	The duration of speech audio (in milliseconds) to include before the start of detected speech.

Defaults to 300 milliseconds.

This property is only applicable for server_vad turn detection.
silence_duration_ms	string	The duration of silence (in milliseconds) to detect the end of speech. You want to detect the end of speech as soon as possible, but not too soon to avoid cutting off the last part of the speech.

The model will respond more quickly if you set this value to a lower number, but it might cut off the last part of the speech. If you set this value to a higher number, the model will wait longer to detect the end of speech, but it might take longer to respond.

Defaults to 500 milliseconds.

This property is only applicable for server_vad turn detection.
create_response	boolean	Indicates whether the server will automatically create a response when VAD is enabled and speech stops.

Defaults to true.
interrupt_response	boolean	Indicates whether the server will automatically interrupt any ongoing response with output to the default (auto) conversation when a VAD start event occurs.

Defaults to true.
eagerness	string	The eagerness of the model to respond and interrupt the user. Specify low to wait longer for the user to continue speaking. Specify high to chunk the audio as soon as possible for quicker responses. The default value is auto that's equivalent to medium.

This property is only applicable for server_vad turn detection.
RealtimeTurnDetectionType
Allowed Values:

semantic_vad - Semantic VAD detects when the user has finished speaking based on the words they have uttered. The input audio is scored based on the probability that the user is done speaking. When the probability is low the model will wait for a timeout. When the probability is high there's no need to wait.
server_vad - The server evaluates user audio from the client. The server automatically uses that audio to initiate response generation on applicable conversations when an end of speech is detected.
RealtimeVoice
Allowed Values:

alloy
ash
ballad
coral
echo
sage
shimmer
verse
    ```

---

## **CLAUDE (Anthropic)**

### **Note: General**
We always want to stream responses whenever possible.

### **Note: Initializing Client (Our Keys/Vertex AI)**
*   **Link:** [`claude-on-vertex-ai`](https://docs.anthropic.com/en/api/claude-on-vertex-ai)
*   **Content (Key Concepts):**
    ```
    # Vertex AI API

> Anthropic's Claude models are now generally available through [Vertex AI](https://cloud.google.com/vertex-ai).

The Vertex API for accessing Claude is nearly-identical to the [Messages API](/en/api/messages) and supports all of the same options, with two key differences:

* In Vertex, `model` is not passed in the request body. Instead, it is specified in the Google Cloud endpoint URL.
* In Vertex, `anthropic_version` is passed in the request body (rather than as a header), and must be set to the value `vertex-2023-10-16`.

Vertex is also supported by Anthropic's official [client SDKs](/en/api/client-sdks). This guide will walk you through the process of making a request to Claude on Vertex AI in either Python or TypeScript.

Note that this guide assumes you have already have a GCP project that is able to use Vertex AI. See [using the Claude 3 models from Anthropic](https://cloud.google.com/vertex-ai/generative-ai/docs/partner-models/use-claude) for more information on the setup required, as well as a full walkthrough.

## Install an SDK for accessing Vertex AI

First, install Anthropic's [client SDK](/en/api/client-sdks) for your language of choice.

<CodeGroup>
  ```Python Python
  pip install -U google-cloud-aiplatform "anthropic[vertex]"
  ```

  ```TypeScript TypeScript
  npm install @anthropic-ai/vertex-sdk
  ```
</CodeGroup>

## Accessing Vertex AI

### Model Availability

Note that Anthropic model availability varies by region. Search for "Claude" in the [Vertex AI Model Garden](https://cloud.google.com/model-garden) or go to [Use Claude 3](https://cloud.google.com/vertex-ai/generative-ai/docs/partner-models/use-claude) for the latest information.

#### API model names

| Model                          | Vertex AI API model name       |
| ------------------------------ | ------------------------------ |
| Claude Opus 4                  | claude-opus-4\@20250514        |
| Claude Sonnet 4                | claude-sonnet-4\@20250514      |
| Claude Sonnet 3.7              | claude-3-7-sonnet\@20250219    |
| Claude Haiku 3.5               | claude-3-5-haiku\@20241022     |
| Claude Sonnet 3.5              | claude-3-5-sonnet-v2\@20241022 |
| Claude Opus 3 (Public Preview) | claude-3-opus\@20240229        |
| Claude Sonnet 3                | claude-3-sonnet\@20240229      |
| Claude Haiku 3                 | claude-3-haiku\@20240307       |

### Making requests

Before running requests you may need to run `gcloud auth application-default login` to authenticate with GCP.

The following examples shows how to generate text from Claude on Vertex AI:

<CodeGroup>
  ```Python Python
  from anthropic import AnthropicVertex

  project_id = "MY_PROJECT_ID"
  # Where the model is running
  region = "us-east5"

  client = AnthropicVertex(project_id=project_id, region=region)

  message = client.messages.create(
      model="claude-opus-4@20250514",
      max_tokens=100,
      messages=[
          {
              "role": "user",
              "content": "Hey Claude!",
          }
      ],
  )
  print(message)
  ```

  ```TypeScript TypeScript
  import { AnthropicVertex } from '@anthropic-ai/vertex-sdk';

  const projectId = 'MY_PROJECT_ID';
  // Where the model is running
  const region = 'us-east5';

  // Goes through the standard `google-auth-library` flow.
  const client = new AnthropicVertex({
    projectId,
    region,
  });

  async function main() {
    const result = await client.messages.create({
      model: 'claude-opus-4@20250514',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: 'Hey Claude!',
        },
      ],
    });
    console.log(JSON.stringify(result, null, 2));
  }

  main();
  ```

  ```bash Shell
  MODEL_ID=claude-opus-4@20250514
  LOCATION=us-east5
  PROJECT_ID=MY_PROJECT_ID

  curl \
  -X POST \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  https://$LOCATION-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/anthropic/models/${MODEL_ID}:streamRawPredict -d \
  '{
    "anthropic_version": "vertex-2023-10-16",
    "messages": [{
      "role": "user",
      "content": "Hey Claude!"
    }],
    "max_tokens": 100,
  }'
  ```
</CodeGroup>

See our [client SDKs](/en/api/client-sdks) and the official [Vertex AI docs](https://cloud.google.com/vertex-ai/docs) for more details.

## Activity logging

Vertex provides a [request-response logging service](https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/request-response-logging) that allows customers to log the prompts and completions associated with your usage.

Anthropic recommends that you log your activity on at least a 30-day rolling basis in order to understand your activity and investigate any potential misuse.

<Note>
  Turning on this service does not give Google or Anthropic any access to your content.
</Note>

## Feature support

You can find all the features currently supported on Vertex [here](/en/docs/build-with-claude/overview).

    ```

### **Note: Initializing Client (User's Key)**
```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: 'my_api_key', // defaults to process.env["ANTHROPIC_API_KEY"]
});
```

### **Note: Streaming**
*   The full response includes events like `message_start`, `content_block_start`, `ping`, `content_block_delta`, etc.
*   **Link:** [`streaming`](https://docs.anthropic.com/en/docs/build-with-claude/streaming)
*   **Content (Key Concepts):**
    ```
    # Streaming Messages

When creating a Message, you can set `"stream": true` to incrementally stream the response using [server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent%5Fevents/Using%5Fserver-sent%5Fevents) (SSE).

## Streaming with SDKs

Our [Python](https://github.com/anthropics/anthropic-sdk-python) and [TypeScript](https://github.com/anthropics/anthropic-sdk-typescript) SDKs offer multiple ways of streaming. The Python SDK allows both sync and async streams. See the documentation in each SDK for details.

<CodeGroup>
  ```Python Python
  import anthropic

  client = anthropic.Anthropic()

  with client.messages.stream(
      max_tokens=1024,
      messages=[{"role": "user", "content": "Hello"}],
      model="claude-opus-4-20250514",
  ) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)
  ```

  ```TypeScript TypeScript
  import Anthropic from '@anthropic-ai/sdk';

  const client = new Anthropic();

  await client.messages.stream({
      messages: [{role: 'user', content: "Hello"}],
      model: 'claude-opus-4-20250514',
      max_tokens: 1024,
  }).on('text', (text) => {
      console.log(text);
  });
  ```
</CodeGroup>

## Event types

Each server-sent event includes a named event type and associated JSON data. Each event will use an SSE event name (e.g. `event: message_stop`), and include the matching event `type` in its data.

Each stream uses the following event flow:

1. `message_start`: contains a `Message` object with empty `content`.
2. A series of content blocks, each of which have a `content_block_start`, one or more `content_block_delta` events, and a `content_block_stop` event. Each content block will have an `index` that corresponds to its index in the final Message `content` array.
3. One or more `message_delta` events, indicating top-level changes to the final `Message` object.
4. A final `message_stop` event.

<Warning>
  The token counts shown in the `usage` field of the `message_delta` event are *cumulative*.
</Warning>

### Ping events

Event streams may also include any number of `ping` events.

### Error events

We may occasionally send [errors](/en/api/errors) in the event stream. For example, during periods of high usage, you may receive an `overloaded_error`, which would normally correspond to an HTTP 529 in a non-streaming context:

```json Example error
event: error
data: {"type": "error", "error": {"type": "overloaded_error", "message": "Overloaded"}}
```

### Other events

In accordance with our [versioning policy](/en/api/versioning), we may add new event types, and your code should handle unknown event types gracefully.

## Content block delta types

Each `content_block_delta` event contains a `delta` of a type that updates the `content` block at a given `index`.

### Text delta

A `text` content block delta looks like:

```JSON Text delta
event: content_block_delta
data: {"type": "content_block_delta","index": 0,"delta": {"type": "text_delta", "text": "ello frien"}}
```

### Input JSON delta

The deltas for `tool_use` content blocks correspond to updates for the `input` field of the block. To support maximum granularity, the deltas are *partial JSON strings*, whereas the final `tool_use.input` is always an *object*.

You can accumulate the string deltas and parse the JSON once you receive a `content_block_stop` event, by using a library like [Pydantic](https://docs.pydantic.dev/latest/concepts/json/#partial-json-parsing) to do partial JSON parsing, or by using our [SDKs](https://docs.anthropic.com/en/api/client-sdks), which provide helpers to access parsed incremental values.

A `tool_use` content block delta looks like:

```JSON Input JSON delta
event: content_block_delta
data: {"type": "content_block_delta","index": 1,"delta": {"type": "input_json_delta","partial_json": "{\"location\": \"San Fra"}}}
```

Note: Our current models only support emitting one complete key and value property from `input` at a time. As such, when using tools, there may be delays between streaming events while the model is working. Once an `input` key and value are accumulated, we emit them as multiple `content_block_delta` events with chunked partial json so that the format can automatically support finer granularity in future models.

### Thinking delta

When using [extended thinking](/en/docs/build-with-claude/extended-thinking#streaming-thinking) with streaming enabled, you'll receive thinking content via `thinking_delta` events. These deltas correspond to the `thinking` field of the `thinking` content blocks.

For thinking content, a special `signature_delta` event is sent just before the `content_block_stop` event. This signature is used to verify the integrity of the thinking block.

A typical thinking delta looks like:

```JSON Thinking delta
event: content_block_delta
data: {"type": "content_block_delta", "index": 0, "delta": {"type": "thinking_delta", "thinking": "Let me solve this step by step:\n\n1. First break down 27 * 453"}}
```

The signature delta looks like:

```JSON Signature delta
event: content_block_delta
data: {"type": "content_block_delta", "index": 0, "delta": {"type": "signature_delta", "signature": "EqQBCgIYAhIM1gbcDa9GJwZA2b3hGgxBdjrkzLoky3dl1pkiMOYds..."}}
```

## Full HTTP Stream response

We strongly recommend that you use our [client SDKs](/en/api/client-sdks) when using streaming mode. However, if you are building a direct API integration, you will need to handle these events yourself.

A stream response is comprised of:

1. A `message_start` event
2. Potentially multiple content blocks, each of which contains:
   * A `content_block_start` event
   * Potentially multiple `content_block_delta` events
   * A `content_block_stop` event
3. A `message_delta` event
4. A `message_stop` event

There may be `ping` events dispersed throughout the response as well. See [Event types](#event-types) for more details on the format.

### Basic streaming request

<CodeGroup>
  ```bash Shell
  curl https://api.anthropic.com/v1/messages \
       --header "anthropic-version: 2023-06-01" \
       --header "content-type: application/json" \
       --header "x-api-key: $ANTHROPIC_API_KEY" \
       --data \
  '{
    "model": "claude-opus-4-20250514",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 256,
    "stream": true
  }'
  ```

  ```python Python
  import anthropic

  client = anthropic.Anthropic()

  with client.messages.stream(
      model="claude-opus-4-20250514",
      messages=[{"role": "user", "content": "Hello"}],
      max_tokens=256,
  ) as stream:
      for text in stream.text_stream:
          print(text, end="", flush=True)
  ```
</CodeGroup>

```json Response
event: message_start
data: {"type": "message_start", "message": {"id": "msg_1nZdL29xx5MUA1yADyHTEsnR8uuvGzszyY", "type": "message", "role": "assistant", "content": [], "model": "claude-opus-4-20250514", "stop_reason": null, "stop_sequence": null, "usage": {"input_tokens": 25, "output_tokens": 1}}}

event: content_block_start
data: {"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}}

event: ping
data: {"type": "ping"}

event: content_block_delta
data: {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": "Hello"}}

event: content_block_delta
data: {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": "!"}}

event: content_block_stop
data: {"type": "content_block_stop", "index": 0}

event: message_delta
data: {"type": "message_delta", "delta": {"stop_reason": "end_turn", "stop_sequence":null}, "usage": {"output_tokens": 15}}

event: message_stop
data: {"type": "message_stop"}

```

### Streaming request with tool use

<Tip>
  Tool use now supports fine-grained streaming for parameter values as a beta feature. For more details, see [Fine-grained tool streaming](/en/docs/agents-and-tools/tool-use/fine-grained-tool-streaming).
</Tip>

In this request, we ask Claude to use a tool to tell us the weather.

<CodeGroup>
  ```bash Shell
    curl https://api.anthropic.com/v1/messages \
      -H "content-type: application/json" \
      -H "x-api-key: $ANTHROPIC_API_KEY" \
      -H "anthropic-version: 2023-06-01" \
      -d '{
        "model": "claude-opus-4-20250514",
        "max_tokens": 1024,
        "tools": [
          {
            "name": "get_weather",
            "description": "Get the current weather in a given location",
            "input_schema": {
              "type": "object",
              "properties": {
                "location": {
                  "type": "string",
                  "description": "The city and state, e.g. San Francisco, CA"
                }
              },
              "required": ["location"]
            }
          }
        ],
        "tool_choice": {"type": "any"},
        "messages": [
          {
            "role": "user",
            "content": "What is the weather like in San Francisco?"
          }
        ],
        "stream": true
      }'
  ```

  ```python Python
  import anthropic

  client = anthropic.Anthropic()

  tools = [
      {
          "name": "get_weather",
          "description": "Get the current weather in a given location",
          "input_schema": {
              "type": "object",
              "properties": {
                  "location": {
                      "type": "string",
                      "description": "The city and state, e.g. San Francisco, CA"
                  }
              },
              "required": ["location"]
          }
      }
  ]

  with client.messages.stream(
      model="claude-opus-4-20250514",
      max_tokens=1024,
      tools=tools,
      tool_choice={"type": "any"},
      messages=[
          {
              "role": "user",
              "content": "What is the weather like in San Francisco?"
          }
      ],
  ) as stream:
      for text in stream.text_stream:
          print(text, end="", flush=True)
  ```
</CodeGroup>

```json Response
event: message_start
data: {"type":"message_start","message":{"id":"msg_014p7gG3wDgGV9EUtLvnow3U","type":"message","role":"assistant","model":"claude-opus-4-20250514","stop_sequence":null,"usage":{"input_tokens":472,"output_tokens":2},"content":[],"stop_reason":null}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

event: ping
data: {"type": "ping"}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Okay"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":","}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" let"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"'s"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" check"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" the"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" weather"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" for"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" San"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" Francisco"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":","}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" CA"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":":"}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: content_block_start
data: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_01T1x1fJ34qAmk2tNTrN7Up6","name":"get_weather","input":{}}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\"location\":"}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":" \"San"}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":" Francisc"}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"o,"}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":" CA\""}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":", "}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"\"unit\": \"fah"}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"renheit\"}"}}

event: content_block_stop
data: {"type":"content_block_stop","index":1}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"tool_use","stop_sequence":null},"usage":{"output_tokens":89}}

event: message_stop
data: {"type":"message_stop"}
```

### Streaming request with extended thinking

In this request, we enable extended thinking with streaming to see Claude's step-by-step reasoning.

<CodeGroup>
  ```bash Shell
  curl https://api.anthropic.com/v1/messages \
       --header "x-api-key: $ANTHROPIC_API_KEY" \
       --header "anthropic-version: 2023-06-01" \
       --header "content-type: application/json" \
       --data \
  '{
      "model": "claude-opus-4-20250514",
      "max_tokens": 20000,
      "stream": true,
      "thinking": {
          "type": "enabled",
          "budget_tokens": 16000
      },
      "messages": [
          {
              "role": "user",
              "content": "What is 27 * 453?"
          }
      ]
  }'
  ```

  ```python Python
  import anthropic

  client = anthropic.Anthropic()

  with client.messages.stream(
      model="claude-opus-4-20250514",
      max_tokens=20000,
      thinking={
          "type": "enabled",
          "budget_tokens": 16000
      },
      messages=[
          {
              "role": "user",
              "content": "What is 27 * 453?"
          }
      ],
  ) as stream:
      for event in stream:
          if event.type == "content_block_delta":
              if event.delta.type == "thinking_delta":
                  print(event.delta.thinking, end="", flush=True)
              elif event.delta.type == "text_delta":
                  print(event.delta.text, end="", flush=True)
  ```
</CodeGroup>

```json Response
event: message_start
data: {"type": "message_start", "message": {"id": "msg_01...", "type": "message", "role": "assistant", "content": [], "model": "claude-opus-4-20250514", "stop_reason": null, "stop_sequence": null}}

event: content_block_start
data: {"type": "content_block_start", "index": 0, "content_block": {"type": "thinking", "thinking": ""}}

event: content_block_delta
data: {"type": "content_block_delta", "index": 0, "delta": {"type": "thinking_delta", "thinking": "Let me solve this step by step:\n\n1. First break down 27 * 453"}}

event: content_block_delta
data: {"type": "content_block_delta", "index": 0, "delta": {"type": "thinking_delta", "thinking": "\n2. 453 = 400 + 50 + 3"}}

event: content_block_delta
data: {"type": "content_block_delta", "index": 0, "delta": {"type": "thinking_delta", "thinking": "\n3. 27 * 400 = 10,800"}}

event: content_block_delta
data: {"type": "content_block_delta", "index": 0, "delta": {"type": "thinking_delta", "thinking": "\n4. 27 * 50 = 1,350"}}

event: content_block_delta
data: {"type": "content_block_delta", "index": 0, "delta": {"type": "thinking_delta", "thinking": "\n5. 27 * 3 = 81"}}

event: content_block_delta
data: {"type": "content_block_delta", "index": 0, "delta": {"type": "thinking_delta", "thinking": "\n6. 10,800 + 1,350 + 81 = 12,231"}}

event: content_block_delta
data: {"type": "content_block_delta", "index": 0, "delta": {"type": "signature_delta", "signature": "EqQBCgIYAhIM1gbcDa9GJwZA2b3hGgxBdjrkzLoky3dl1pkiMOYds..."}}

event: content_block_stop
data: {"type": "content_block_stop", "index": 0}

event: content_block_start
data: {"type": "content_block_start", "index": 1, "content_block": {"type": "text", "text": ""}}

event: content_block_delta
data: {"type": "content_block_delta", "index": 1, "delta": {"type": "text_delta", "text": "27 * 453 = 12,231"}}

event: content_block_stop
data: {"type": "content_block_stop", "index": 1}

event: message_delta
data: {"type": "message_delta", "delta": {"stop_reason": "end_turn", "stop_sequence": null}}

event: message_stop
data: {"type": "message_stop"}
```

### Streaming request with web search tool use

In this request, we ask Claude to search the web for current weather information.

<CodeGroup>
  ```bash Shell
  curl https://api.anthropic.com/v1/messages \
       --header "x-api-key: $ANTHROPIC_API_KEY" \
       --header "anthropic-version: 2023-06-01" \
       --header "content-type: application/json" \
       --data \
  '{
      "model": "claude-opus-4-20250514",
      "max_tokens": 1024,
      "stream": true,
      "messages": [
          {
              "role": "user",
              "content": "What is the weather like in New York City today?"
          }
      ]
  }'
  ```

  ```python Python
  import anthropic

  client = anthropic.Anthropic()

  with client.messages.stream(
      model="claude-opus-4-20250514",
      max_tokens=1024,
      messages=[
          {
              "role": "user",
              "content": "What is the weather like in New York City today?"
          }
      ],
  ) as stream:
      for text in stream.text_stream:
          print(text, end="", flush=True)
  ```
</CodeGroup>

```json Response
event: message_start
data: {"type":"message_start","message":{"id":"msg_01G...","type":"message","role":"assistant","model":"claude-opus-4-20250514","content":[],"stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":2679,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"output_tokens":3}}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"I'll check"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" the current weather in New York City for you"}}

event: ping
data: {"type": "ping"}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"."}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: content_block_start
data: {"type":"content_block_start","index":1,"content_block":{"type":"server_tool_use","id":"srvtoolu_014hJH82Qum7Td6UV8gDXThB","name":"web_search","input":{}}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\"query"}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"\":"}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":" \"weather"}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":" NY"}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"C to"}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"day\"}"}}

event: content_block_stop
data: {"type":"content_block_stop","index":1 }

event: content_block_start
data: {"type":"content_block_start","index":2,"content_block":{"type":"web_search_tool_result","tool_use_id":"srvtoolu_014hJH82Qum7Td6UV8gDXThB","content":[{"type":"web_search_result","title":"Weather in New York City in May 2025 (New York) - detailed Weather Forecast for a month","url":"https://world-weather.info/forecast/usa/new_york/may-2025/","encrypted_content":"Ev0DCioIAxgCIiQ3NmU4ZmI4OC1k...","page_age":null},...]}}

event: content_block_stop
data: {"type":"content_block_stop","index":2}

event: content_block_start
data: {"type":"content_block_start","index":3,"content_block":{"type":"text","text":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":3,"delta":{"type":"text_delta","text":"Here's the current weather information for New York"}}

event: content_block_delta
data: {"type":"content_block_delta","index":3,"delta":{"type":"text_delta","text":" City:\n\n# Weather"}}

event: content_block_delta
data: {"type":"content_block_delta","index":3,"delta":{"type":"text_delta","text":" in New York City"}}

event: content_block_delta
data: {"type":"content_block_delta","index":3,"delta":{"type":"text_delta","text":"\n\n"}}

...

event: content_block_stop
data: {"type":"content_block_stop","index":17}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"input_tokens":10682,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"output_tokens":510,"server_tool_use":{"web_search_requests":1}}}

event: message_stop
data: {"type":"message_stop"}
```

    ```

### **Note: Vision (Image Uploads using Files API, not base64)**
*   It’s best to place images earlier in the prompt than questions about them or instructions for tasks that use them.
```typescript
import { Anthropic, toFile } from '@anthropic-ai/sdk';
import fs from 'fs';

const anthropic = new Anthropic();

async function main() {
  // Upload the image file
  const fileUpload = await anthropic.beta.files.upload({
    file: toFile(fs.createReadStream('image.jpg'), undefined, { type: "image/jpeg" })
  });

  // Use the uploaded file in a message
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'file',
              file_id: fileUpload.id
            }
          },
          {
            type: 'text',
            text: 'Describe this image.'
          }
        ]
      }
    ]
  });

  console.log(response);
}

main();
```

### **Note: File Uploads (PDFs using Files API)**
```typescript
import { Anthropic, toFile } from '@anthropic-ai/sdk';
import fs from 'fs';

const anthropic = new Anthropic();

async function main() {
  // Upload the PDF file
  const fileUpload = await anthropic.beta.files.upload({
    file: toFile(fs.createReadStream('document.pdf'), undefined, { type: 'application/pdf' })
  });

  // Use the uploaded file in a message
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'file',
              file_id: fileUpload.id
            }
          },
          {
            type: 'text',
            text: 'What are the key findings in this document?'
          }
        ]
      }
    ]
  });

  console.log(response);
}

main();
```

### **Note: Prompt Caching**
Use prompt caching to improve performance on repeated queries:
```typescript
const response = await anthropic.messages.create({
  model: 'claude-opus-4-20250514',
  max_tokens: 1024,
  messages: [
    {
      content: [
        {
          type: 'document',
          source: {
            media_type: 'application/pdf',
            type: 'base64',
            data: pdfBase64,
          },
          cache_control: { type: 'ephemeral' },
        },
        {
          type: 'text',
          text: 'Which model has the highest human preference win rates across each use-case?',
        },
      ],
      role: 'user',
    },
  ],
});
console.log(response);
```

### **Note: Web Search**
*   **Note:** Ensure proper handling of citations and prompt caching here. We have some works on source citations already in `#file:MessageList.tsx` and `#file:ai.ts` already, so feel free to review, emulate and extend.
*   **Link:** [`web-search-tool`](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/web-search-tool)
*   **Content (Key Concepts):**
    ```
    # Web search tool

The web search tool gives Claude direct access to real-time web content, allowing it to answer questions with up-to-date information beyond its knowledge cutoff. Claude automatically cites sources from search results as part of its answer.

<Note>
  Please reach out through our [feedback form](https://forms.gle/sWjBtsrNEY2oKGuE8) to share your experience with the web search tool.
</Note>

## Supported models

Web search is available on:

* Claude Opus 4 (`claude-opus-4-20250514`)
* Claude Sonnet 4 (`claude-sonnet-4-20250514`)
* Claude Sonnet 3.7 (`claude-3-7-sonnet-20250219`)
* Claude Sonnet 3.5 (new) (`claude-3-5-sonnet-latest`)
* Claude Haiku 3.5 (`claude-3-5-haiku-latest`)

## How web search works

When you add the web search tool to your API request:

1. Claude decides when to search based on the prompt.
2. The API executes the searches and provides Claude with the results. This process may repeat multiple times throughout a single request.
3. At the end of its turn, Claude provides a final response with cited sources.

## How to use web search

<Note>
  Your organization's administrator must enable web search in [Console](https://console.anthropic.com/settings/privacy).
</Note>

Provide the web search tool in your API request:

<CodeGroup>
  ```bash Shell
  curl https://api.anthropic.com/v1/messages \
      --header "x-api-key: $ANTHROPIC_API_KEY" \
      --header "anthropic-version: 2023-06-01" \
      --header "content-type: application/json" \
      --data '{
          "model": "claude-opus-4-20250514",
          "max_tokens": 1024,
          "messages": [
              {
                  "role": "user",
                  "content": "How do I update a web app to TypeScript 5.5?"
              }
          ],
          "tools": [{
              "type": "web_search_20250305",
              "name": "web_search",
              "max_uses": 5
          }]
      }'
  ```

  ```python Python
  import anthropic

  client = anthropic.Anthropic()

  response = client.messages.create(
      model="claude-opus-4-20250514",
      max_tokens=1024,
      messages=[
          {
              "role": "user",
              "content": "How do I update a web app to TypeScript 5.5?"
          }
      ],
      tools=[{
          "type": "web_search_20250305",
          "name": "web_search",
          "max_uses": 5
      }]
  )
  print(response)
  ```

  ```typescript TypeScript
  import { Anthropic } from '@anthropic-ai/sdk';

  const anthropic = new Anthropic();

  async function main() {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: "How do I update a web app to TypeScript 5.5?"
        }
      ],
      tools: [{
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 5
      }]
    });

    console.log(response);
  }

  main().catch(console.error);
  ```
</CodeGroup>

### Tool definition

The web search tool supports the following parameters:

```json JSON
{
  "type": "web_search_20250305",
  "name": "web_search",

  // Optional: Limit the number of searches per request
  "max_uses": 5,

  // Optional: Only include results from these domains
  "allowed_domains": ["example.com", "trusteddomain.org"],

  // Optional: Never include results from these domains
  "blocked_domains": ["untrustedsource.com"],

  // Optional: Localize search results
  "user_location": {
    "type": "approximate",
    "city": "San Francisco",
    "region": "California",
    "country": "US",
    "timezone": "America/Los_Angeles"
  }
}
```

#### Max uses

The `max_uses` parameter limits the number of searches performed. If Claude attempts more searches than allowed, the `web_search_tool_result` will be an error with the `max_uses_exceeded` error code.

#### Domain filtering

When using domain filters:

* Domains should not include the HTTP/HTTPS scheme (use `example.com` instead of `https://example.com`)
* Subdomains are automatically included (`example.com` covers `docs.example.com`)
* Subpaths are supported (`example.com/blog`)
* You can use either `allowed_domains` or `blocked_domains`, but not both in the same request.

#### Localization

The `user_location` parameter allows you to localize search results based on a user's location.

* `type`: The type of location (must be `approximate`)
* `city`: The city name
* `region`: The region or state
* `country`: The country
* `timezone`: The [IANA timezone ID](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones).

### Response

Here's an example response structure:

```json
{
  "role": "assistant",
  "content": [
    // 1. Claude's decision to search
    {
      "type": "text",
      "text": "I'll search for when Claude Shannon was born."
    },
    // 2. The search query used
    {
      "type": "server_tool_use",
      "id": "srvtoolu_01WYG3ziw53XMcoyKL4XcZmE",
      "name": "web_search",
      "input": {
        "query": "claude shannon birth date"
      }
    },
    // 3. Search results
    {
      "type": "web_search_tool_result",
      "tool_use_id": "srvtoolu_01WYG3ziw53XMcoyKL4XcZmE",
      "content": [
        {
          "type": "web_search_result",
          "url": "https://en.wikipedia.org/wiki/Claude_Shannon",
          "title": "Claude Shannon - Wikipedia",
          "encrypted_content": "EqgfCioIARgBIiQ3YTAwMjY1Mi1mZjM5LTQ1NGUtODgxNC1kNjNjNTk1ZWI3Y...",
          "page_age": "April 30, 2025"
        }
      ]
    },
    {
      "text": "Based on the search results, ",
      "type": "text"
    },
    // 4. Claude's response with citations
    {
      "text": "Claude Shannon was born on April 30, 1916, in Petoskey, Michigan",
      "type": "text",
      "citations": [
        {
          "type": "web_search_result_location",
          "url": "https://en.wikipedia.org/wiki/Claude_Shannon",
          "title": "Claude Shannon - Wikipedia",
          "encrypted_index": "Eo8BCioIAhgBIiQyYjQ0OWJmZi1lNm..",
          "cited_text": "Claude Elwood Shannon (April 30, 1916 – February 24, 2001) was an American mathematician, electrical engineer, computer scientist, cryptographer and i..."
        }
      ]
    }
  ],
  "id": "msg_a930390d3a",
  "usage": {
    "input_tokens": 6039,
    "output_tokens": 931,
    "server_tool_use": {
      "web_search_requests": 1
    }
  },
  "stop_reason": "end_turn"
}
```

#### Search results

Search results include:

* `url`: The URL of the source page
* `title`: The title of the source page
* `page_age`: When the site was last updated
* `encrypted_content`: Encrypted content that must be passed back in multi-turn conversations for citations

#### Citations

Citations are always enabled for web search, and each `web_search_result_location` includes:

* `url`: The URL of the cited source
* `title`: The title of the cited source
* `encrypted_index`: A reference that must be passed back for multi-turn conversations.
* `cited_text`: Up to 150 characters of the cited content

The web search citation fields `cited_text`, `title`, and `url` do not count towards input or output token usage.

<Note>
  When displaying web results or information contained in web results to end users, inline citations must be made clearly visible and clickable in your user interface.
</Note>

#### Errors

If an error occurs during web search, you'll receive a response that takes the following form:

```json
{
  "type": "web_search_tool_result",
  "tool_use_id": "servertoolu_a93jad",
  "content": {
    "type": "web_search_tool_result_error",
    "error_code": "max_uses_exceeded"
  }
}
```

These are the possible error codes:

* `too_many_requests`: Rate limit exceeded
* `invalid_input`: Invalid search query parameter
* `max_uses_exceeded`: Maximum web search tool uses exceeded
* `query_too_long`: Query exceeds maximum length
* `unavailable`: An internal error occurred

#### `pause_turn` stop reason

The response may include a `pause_turn` stop reason, which indicates that the API paused a long-running turn. You may provide the response back as-is in a subsequent request to let Claude continue its turn, or modify the content if you wish to interrupt the conversation.

## Prompt caching

Web search works with [prompt caching](/en/docs/build-with-claude/prompt-caching). To enable prompt caching, add at least one `cache_control` breakpoint in your request. The system will automatically cache up until the last `web_search_tool_result` block when executing the tool.

For multi-turn conversations, set a `cache_control` breakpoint on or after the last `web_search_tool_result` block to reuse cached content.

For example, to use prompt caching with web search for a multi-turn conversation:

<CodeGroup>
  ```python
  import anthropic

  client = anthropic.Anthropic()

  # First request with web search and cache breakpoint
  messages = [
      {
          "role": "user",
          "content": "What's the current weather in San Francisco today?"
      }
  ]

  response1 = client.messages.create(
      model="claude-opus-4-20250514",
      max_tokens=1024,
      messages=messages,
      tools=[{
          "type": "web_search_20250305",
          "name": "web_search",
          "user_location": {
              "type": "approximate",
              "city": "San Francisco",
              "region": "California",
              "country": "US",
              "timezone": "America/Los_Angeles"
          }
      }]
  )

  # Add Claude's response to the conversation
  messages.append({
      "role": "assistant",
      "content": response1.content
  })

  # Second request with cache breakpoint after the search results
  messages.append({
      "role": "user",
      "content": "Should I expect rain later this week?",
      "cache_control": {"type": "ephemeral"}  # Cache up to this point
  })

  response2 = client.messages.create(
      model="claude-opus-4-20250514",
      max_tokens=1024,
      messages=messages,
      tools=[{
          "type": "web_search_20250305",
          "name": "web_search",
          "user_location": {
              "type": "approximate",
              "city": "San Francisco",
              "region": "California",
              "country": "US",
              "timezone": "America/Los_Angeles"
          }
      }]
  )
  # The second response will benefit from cached search results
  # while still being able to perform new searches if needed
  print(f"Cache read tokens: {response2.usage.get('cache_read_input_tokens', 0)}")
  ```
</CodeGroup>

## Streaming

With streaming enabled, you'll receive search events as part of the stream. There will be a pause while the search executes:

```javascript
event: message_start
data: {"type": "message_start", "message": {"id": "msg_abc123", "type": "message"}}

event: content_block_start
data: {"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}}

// Claude's decision to search

event: content_block_start
data: {"type": "content_block_start", "index": 1, "content_block": {"type": "server_tool_use", "id": "srvtoolu_xyz789", "name": "web_search"}}

// Search query streamed
event: content_block_delta
data: {"type": "content_block_delta", "index": 1, "delta": {"type": "input_json_delta", "partial_json": "{\"query\":\"latest quantum computing breakthroughs 2025\"}"}}

// Pause while search executes

// Search results streamed
event: content_block_start
data: {"type": "content_block_start", "index": 2, "content_block": {"type": "web_search_tool_result", "tool_use_id": "srvtoolu_xyz789", "content": [{"type": "web_search_result", "title": "Quantum Computing Breakthroughs in 2025", "url": "https://example.com"}]}}

// Claude's response with citations (omitted in this example)
```

## Batch requests

You can include the web search tool in the [Messages Batches API](/en/docs/build-with-claude/batch-processing). Web search tool calls through the Messages Batches API are priced the same as those in regular Messages API requests.

## Usage and pricing

Web search usage is charged in addition to token usage:

```json
"usage": {
  "input_tokens": 105,
  "output_tokens": 6039,
  "cache_read_input_tokens": 7123,
  "cache_creation_input_tokens": 7345,
  "server_tool_use": {
    "web_search_requests": 1
  }
}
```

Web search is available on the Anthropic API for \$10 per 1,000 searches, plus standard token costs for search-generated content. Web search results retrieved throughout a conversation are counted as input tokens, in search iterations executed during a single turn and in subsequent conversation turns.

Each web search counts as one use, regardless of the number of results returned. If an error occurs during web search, the web search will not be billed.

    ```

### **Note: Structured JSON/JSON Mode**
*   **Note:** Use `tools` to get Claude to produce JSON output that follows a schema, even if you don’t have any intention of running that output through a tool or function. You usually want to provide a single tool and set `tool_choice` to instruct the model to explicitly use that tool. The name of the tool and description should be from the model’s perspective.
*   **Example from Docs:**
    ```typescript
    import Anthropic from "@anthropic-ai/sdk";

    const client = new Anthropic();

    const response = await client.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 1024,
      messages: [{ role: "user", content: "Create a compelling headline and a short 2-3 sentence paragraph for a blog post about the importance of brand storytelling. The tone should be inspiring and persuasive." }],
      tool_choice: { type: "tool", name: "blog_post_formatter" },
      tools: [
        {
          name: "blog_post_formatter",
          description: "A tool to format a blog post with a headline and a paragraph.",
          input_schema: {
            type: "object",
            properties: {
              headline: {
                type: "string",
                description: "The headline of the blog post. This should be catchy and inspiring.",
              },
              paragraph: {
                type: "string",
                description: "A short 2-3 sentence paragraph for the blog post. This should be persuasive and inspiring.",
              },
            },
            required: ["headline", "paragraph"],
          },
        },
      ],
    });
    // The response will contain a tool_use block with the JSON arguments.
    ```

### **Note: Image/Video/Live Chat**
*   Not supported by Anthropic's API at this time.

**OPENROUTER:**
* It's compatible with open ai's sdk so we just authenticate with our openrouter key, and when using the user's we use their key. we authenticate with the baseURL and apikey fields in the OpenAI's class.
* **Scope**: Just text output/generation with models from google, openai and anthropic.