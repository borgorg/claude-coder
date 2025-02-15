import * as vscode from "vscode"
import { ApiModelId, koduDefaultModelId, KoduModelId, koduModels } from "../../shared/api"
import { fetchKoduUser as fetchKoduUserAPI } from "../../api/providers/kodu"
import { ExtensionProvider } from "../extension-provider"

export class ApiManager {
	private static instance: ApiManager | null = null
	private context: ExtensionProvider

	private constructor(context: ExtensionProvider) {
		this.context = context
	}

	public static getInstance(context?: ExtensionProvider): ApiManager {
		if (!ApiManager.instance) {
			if (!context) {
				throw new Error("ExtensionProvider context must be provided when creating the ApiManager instance")
			}
			ApiManager.instance = new ApiManager(context)
		}
		return ApiManager.instance
	}

	async updateApiConfiguration(apiConfiguration: {
		apiModelId?: KoduModelId
		koduApiKey?: string
		browserModelId?: string
	}) {
		const { apiModelId, koduApiKey, browserModelId } = apiConfiguration
		if (apiModelId) {
			await this.context.getGlobalStateManager().updateGlobalState("apiModelId", apiModelId)
		}
		if (browserModelId) {
			await this.context.getGlobalStateManager().updateGlobalState("browserModelId", browserModelId)
		}
		if (koduApiKey) {
			await this.context.getSecretStateManager().updateSecretState("koduApiKey", koduApiKey)
		}
	}

	getCurrentModelInfo() {
		const apiModelId = this.context.getGlobalStateManager().getGlobalState("apiModelId") as ApiModelId
		return koduModels[apiModelId]
	}

	async saveKoduApiKey(apiKey: string) {
		await this.context.getSecretStateManager().updateSecretState("koduApiKey", apiKey)
		console.log("Saved Kodu API key")
		const modelId = await this.context.getKoduDev()?.getStateManager().apiManager.getModelId()
		await this.context
			.getKoduDev()
			?.getStateManager()
			.apiManager.updateApi({
				koduApiKey: apiKey,
				apiModelId:
					modelId ?? this.context.getGlobalStateManager().getGlobalState("apiModelId") ?? koduDefaultModelId,
			})
		const user = await this.fetchKoduUser(apiKey)
		await this.context.getGlobalStateManager().updateGlobalState("user", user)
		await this.context.getWebviewManager().postBaseStateToWebview()
		console.log("Posted state to webview after saving Kodu API key")
		await this.context.getWebviewManager().postMessageToWebview({ type: "action", action: "koduAuthenticated" })
		console.log("Posted message to action: koduAuthenticated")
	}

	async signOutKodu() {
		await this.context.getSecretStateManager().deleteSecretState("koduApiKey")
		await this.context.getGlobalStateManager().updateGlobalState("user", undefined)
	}

	async fetchKoduCredits() {
		const koduApiKey = await this.context.getSecretStateManager().getSecretState("koduApiKey")
		if (koduApiKey) {
			const user = await this.fetchKoduUser(koduApiKey)
			if (user) {
				await this.context.getGlobalStateManager().updateGlobalState("user", user)
			}
		}
	}

	private async fetchKoduUser(apiKey: string) {
		return await fetchKoduUserAPI({ apiKey })
	}
}
