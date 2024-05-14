/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CriaPedidoDTO } from './dto/CriaPedido.dto';
import { AtualizaPedidoDto } from './dto/AtualizaPedido.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { PedidoEntity } from './pedido.entity';
import { In, Repository } from 'typeorm';
import { UsuarioEntity } from '../usuario/usuario.entity';
import { StatusPedido } from './enum/statuspedido.enum';
import { ItemPedidoEntity } from './itempedido.entity';
import { ProdutoEntity } from '../produto/produto.entity';

@Injectable()
export class PedidoService {
  constructor(
    @InjectRepository(PedidoEntity)
    private readonly pedidoRepository: Repository<PedidoEntity>,
    @InjectRepository(UsuarioEntity)
    private readonly usuarioRepository: Repository<UsuarioEntity>,
    @InjectRepository(ProdutoEntity)
    private readonly produtoRepository: Repository<ProdutoEntity>,
  ) {}

  private async bucaUsuario(id) {
    const usuario = await this.usuarioRepository.findOneBy({ id });

    if (usuario === null) {
      throw new NotFoundException('usuário não encontrado');
    }

    return usuario;
  }

  private tratarDadosDoPedido(
    dadosDoPedido: CriaPedidoDTO,
    produtosRelacionados: ProdutoEntity[],
  ) {
    dadosDoPedido.itensPedido.forEach((itemPedido) => {
      const produtoRelacionado = produtosRelacionados.find(
        (produto) => produto.id === itemPedido.produtoId,
      );

      if (produtoRelacionado === undefined) {
        throw new NotFoundException(
          `O produto ${itemPedido.produtoId} não foi encontrado`,
        );
      }

      if (itemPedido.quantidade > produtoRelacionado.quantidadeDisponivel) {
        throw new BadRequestException(
          `A quantidade solicitada (${itemPedido.quantidade}) é maior do que a disponível (${produtoRelacionado.quantidadeDisponivel}) para o produto ${produtoRelacionado.nome}.`,
        );
      }
    });
  }

  async cadastraPedido(usuarioId: string, dadosDoPedido: CriaPedidoDTO) {
    const usuario = await this.bucaUsuario(usuarioId);

    const produtosIds = dadosDoPedido.itensPedido.map(
      (itemPedido) => itemPedido.produtoId,
    );
    const pedidoEntity = new PedidoEntity();

    pedidoEntity.status = StatusPedido.EM_PROCESSAMENTO;
    pedidoEntity.usuario = usuario;

    const produtosRelacionados = await this.produtoRepository.findBy({
      id: In(produtosIds),
    });

    this.tratarDadosDoPedido(dadosDoPedido, produtosRelacionados);

    const itensPedidoEntidades = dadosDoPedido.itensPedido.map((itemPedido) => {
      const produtoRelacionado = produtosRelacionados.find(
        (produto) => produto.id === itemPedido.produtoId,
      );

      const itemPedidoEntity = new ItemPedidoEntity();
      itemPedidoEntity.produto = produtoRelacionado!;
      itemPedidoEntity.precoVenda = produtoRelacionado!.valor;
      itemPedidoEntity.quantidade = itemPedido.quantidade;
      itemPedidoEntity.produto.quantidadeDisponivel -= itemPedido.quantidade;
      return itemPedidoEntity;
    });

    const valorTotal = itensPedidoEntidades.reduce((total, item) => {
      return total + item.precoVenda * item.quantidade;
    }, 0);

    pedidoEntity.itensPedido = itensPedidoEntidades;

    pedidoEntity.valorTotal = valorTotal;

    const pedidoCriado = await this.pedidoRepository.save(pedidoEntity);
    return pedidoCriado;
  }
  async obtemPedidosDeUsuario(usuarioId: string) {
    const usuario = await this.bucaUsuario(usuarioId);
    if (!usuario) {
      throw new NotFoundException('usuário não encontrado');
    }
    return this.pedidoRepository.find({
      where: {
        usuario: { id: usuarioId },
      },
      relations: {
        usuario: true,
      },
    });
  }

  async atualizaPedido(id: string, dto: AtualizaPedidoDto) {
    /*try {
      this.validateUUID(id);
    } catch (error) {
      console.error(error.message);
      throw new BadRequestException('UUID inválido');
    }*/
    const pedido = await this.pedidoRepository.findOneBy({ id });

    if (pedido === null) {
      throw new NotFoundException('Pedido não encontrado');
    }

    Object.assign(pedido, dto as PedidoEntity);

    return this.pedidoRepository.save(pedido);
  }

  validateUUID(id: string) {
    const uuidRegex =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidRegex.test(id)) {
      throw new Error('UUID no formato incorreto');
    }
  }
}
