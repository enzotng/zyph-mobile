import { Component, type ErrorInfo, type ReactNode } from 'react'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { ErrorState } from '@/components/ui'
import i18n from '@/lib/i18n'

type Props = { children: ReactNode }
type State = { error: Error | null }

// Catches render-time errors anywhere below it so one broken screen does not
// crash the whole app. Copy is read from the i18n instance (no hook in a class).
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Hook point for crash reporting once a provider is wired.
  }

  reset = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <ErrorState
            title={i18n.t('errors.title')}
            body={i18n.t('errors.body')}
            retryLabel={i18n.t('common.retry')}
            onRetry={this.reset}
          />
        </View>
      )
    }
    return this.props.children
  }
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
}))
